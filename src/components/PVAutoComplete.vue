<template>
  <span v-if="styleShow">
    <span v-if="show_id_enable">{{ show_id }}</span>
    <span v-else>{{ model }}</span> {{ selectedItem.content }}
  </span>
  <InputGroup v-else @keydown.tab.stop>
    <InputText 
      v-if="show_id_enable"
      v-model="show_id" 
      @blur="onUserInputEndShowId" 
      @keydown.enter="onUserInputEndShowId" 
      class="gts-ac__id-field"
      :disabled="disabled"/>
    <InputText 
      v-else
      v-model="model" 
      @blur="onUserInputEnd" 
      @keydown.enter="onUserInputEnd" 
      @focus="idCache = model" 
      class="gts-ac__id-field"
      :disabled="disabled"/>
    <AutoComplete
      v-model="selectedItem"
      dropdown
      option-label="content"
      :suggestions="items"
      class="gts-ac__search-field"
      @complete="search"
      @item-select="onAutocompleteItemSelect"
      @lazy-load="onLazyLoad"
      :disabled="disabled"
      :virtualScrollerOptions="{ itemSize: 24, lazy: true, style: { contain: 'content'} }"
      :panelStyle="{ width: 'auto' }"
      :overlayStyle="{ width: 'auto' }"
    >
      <template v-if="compiledTemplate" #option="{ option, index }">
        <component :is="compiledTemplate" :option="option" :index="index" />
      </template>
    </AutoComplete>
  </InputGroup>
</template>

<script setup>
  import AutoComplete from "./AutoComplete/AutoComplete.vue";
  import InputGroup from "primevue/inputgroup";
  import { ref, watchEffect, onMounted, computed } from "vue";
  import { compile } from "vue";
  import InputText from "primevue/inputtext";
  import { useNotifications } from "./useNotifications.js";
  import apiCtor from './api.js'

  const model = defineModel({
    type: [String,Number],
    default: "",
  });
  const show_id_enable = ref(false)
  const show_id = ref('')
  const props = defineProps({
    field: {
      type: Object,
      default: () => {}
    }, 
    disabled: {
      type: Boolean,
      default: false,
    },
    options: {
      type: Object,
      default: () => {}
    },
    styleShow: {
      type: Boolean,
      default: false
    }
  });

  const api = apiCtor(props.field.table)
  const emit = defineEmits(['update:id', 'set-value']);

  const { notify } = useNotifications()
  const idCache = ref('')
  const items = ref([]);
  const selectedItem = ref({});

  // Состояние пагинации для виртуального скроллинга
  const pagination = ref({
    offset: 0,
    limit: 10,
    loading: false,
    hasMore: true,
    total: 0,
    currentQuery: '',
    allowLazyLoad: false
  });

  // Функция валидации шаблона на предмет безопасности
  const validateTemplate = (template) => {
    if (!template || typeof template !== 'string') return true;
    
    // Запрещенные паттерны для безопасности
    const forbiddenPatterns = [
      /\$parent/gi,
      /\$root/gi,
      /document\./gi,
      /window\./gi,
      /eval\(/gi,
      /<script/gi,
      /javascript:/gi,
      /constructor\.constructor/gi,
      /__proto__/gi,
      /localStorage/gi,
      /sessionStorage/gi,
      /fetch\(/gi,
      /XMLHttpRequest/gi,
      /WebSocket/gi,
      /setTimeout/gi,
      /setInterval/gi,
      /import\(/gi,
      /require\(/gi,
      /process\./gi,
      /global\./gi
    ];
    
    // Проверяем на наличие запрещенных паттернов
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(template)) {
        console.warn(`Обнаружен потенциально опасный паттерн в шаблоне: ${pattern}`);
        return false;
      }
    }
    
    return true;
  };

  // Компиляция шаблона из строки (приоритет: API ответ, затем props.field.template)
  const compiledTemplate = computed(() => {
    const templateSource = apiTemplate.value || props.field.template;
    if (!templateSource) return null;
    
    // Валидация шаблона перед компиляцией
    if (!validateTemplate(templateSource)) {
      console.error('Шаблон содержит потенциально опасные конструкции');
      notify('error', { detail: 'Шаблон содержит потенциально опасные конструкции и не может быть использован' });
      return null;
    }
    
    try {
      return compile(templateSource);
    } catch (error) {
      console.error('Ошибка компиляции шаблона:', error);
      notify('error', { detail: `Ошибка в шаблоне: ${error.message}` });
      return null;
    }
  });

  // Шаблон из API ответа
  const apiTemplate = ref('');

  const default_row = async () => {
    if(props.field.default_row){
      try {
        
        const response = await api.autocomplete({query:'',ids:''})
        items.value = response.data.rows;
        if(response.data.default) model.value = response.data.default
      } catch (error) {
        notify('error', { detail: error.message });
      }
    }
  }
  onMounted(()=>{
    default_row()
  })
  

  watchEffect(async () => {
    
    if (props.options && Number(model.value) == 0){
      if(Number(props.options.default) > 0){
        model.value = props.options.default
      }
      if(props.field.defaultname){
        try {
          if(!props.field.ids){
            props.field.ids = ''
          }
          const response = await api.autocomplete({query:props.field.defaultname,parent:props.field.parent,ids:props.field.ids})
          model.value = response.data.rows[0]?.id || "";
        } catch (error) {
          notify('error', { detail: error.message });
        }
      }
    }
    if(props.field.show_id){
      show_id_enable.value = true
    }

    if (props.options && Array.isArray(props.options.rows) && props.options.rows.length) {
      const [ option ] = props.options.rows.filter((option) => model.value == option.id)
      if (option) {
        selectedItem.value = option
        if(props.field.show_id){
          if(option[props.field.show_id] > 0){
            show_id.value = option[props.field.show_id]
          }else{
            show_id.value = model.value
          }
        }
      }
    }else if(Number(model.value) > 0){
      try {
        const option = await getOptionById(model.value);

        if (!option) {
          notify('error', { detail: 'Отсутствует такой ID! id=' + model.value + ' table=' +props.field.table })
          return
        }

        selectedItem.value = option

        if(props.field.show_id){
          if(option[props.field.show_id] > 0){
            show_id.value = option[props.field.show_id]
          }else{
            show_id.value = model.value
          }
        }
      } catch (error) {
        notify('error', { detail: error.message })
      }
    }
  })

  

  const search = async ({ query }) => {
    try {
      // Сбрасываем пагинацию при новом поиске
      pagination.value.offset = 0;
      pagination.value.hasMore = true;
      pagination.value.currentQuery = query;
      pagination.value.allowLazyLoad = false; // Запрещаем ленивую загрузку до завершения поиска
      
      if(!props.field.ids){
        props.field.ids = ''
      }
      
      const params = {
        query: query,
        parent: props.field.parent,
        ids: props.field.ids,
        limit: pagination.value.limit,
        offset: pagination.value.offset
      };
      
      // Передаем параметр where, если он указан в поле
      if (props.field.where) {
        params.where = props.field.where;
      }
      
      const response = await api.autocomplete(params);
      items.value = response.data.rows;
      pagination.value.total = response.data.total || 0;
      pagination.value.hasMore = items.value.length < pagination.value.total;
      
      // Сохраняем шаблон из API ответа
      if (response.data.template) {
        apiTemplate.value = response.data.template;
      }
      
      // Разрешаем ленивую загрузку только после успешного поиска
      setTimeout(() => {
        pagination.value.allowLazyLoad = true;
      }, 100);
    } catch (error) {
      notify('error', { detail: error.message });
    }
  };

  async function getOptionById(id) {
    const params = {
      id: id,
      parent: props.field.parent
    };
    
    if (props.field.where) {
      params.where = props.field.where;
    }
    
    const response = await api.autocomplete(params);
    return response.data.rows[0] || null;
  }
  async function getOptionByShowId(show_id) {
    const params = {
      show_id: show_id,
      parent: props.field.parent
    };
    
    if (props.field.where) {
      params.where = props.field.where;
    }
    
    const response = await api.autocomplete(params);
    return response.data.rows[0] || null;
  }
  const onUserInputEnd = async ($evt) => {
    const userInput = $evt.target.value

    if (userInput === '' || userInput === '0') {
      model.value = userInput
      selectedItem.value = {}
      return
    }

    try {
      const option = await getOptionById($evt.target.value);

      if (!option) {
        notify('error', { detail: 'Отсутствует такой ID' })
        model.value = idCache.value
        return
      }

      selectedItem.value = option
      model.value = userInput
      if(props.field.show_id){
        if(option[props.field.show_id] > 0){
          show_id.value = option[props.field.show_id]
        }else{
          show_id.value = model.value
        }
      }
    } catch (error) {
      notify('error', { detail: error.message })
    }

    emit('set-value')
  }
  const onUserInputEndShowId = async ($evt) => {
    const userInput = $evt.target.value

    if (userInput === '' || userInput === '0') {
      model.value = userInput
      selectedItem.value = {}
      return
    }

    try {
      const option = await getOptionByShowId($evt.target.value);

      if (!option) {
        notify('error', { detail: 'Отсутствует такой ID' })
        model.value = idCache.value
        return
      }

      selectedItem.value = option
      model.value = option.id
      if(props.field.show_id){
        if(option[props.field.show_id] > 0){
          show_id.value = option[props.field.show_id]
        }else{
          show_id.value = model.value
        }
      }
    } catch (error) {
      notify('error', { detail: error.message })
    }

    emit('set-value')
  }
  const onAutocompleteItemSelect = ($evt) => {
    model.value = $evt.value.id;
    // selectedItem.value = $evt.value
    if(props.field.show_id){
      if($evt.value[props.field.show_id]){
        show_id.value = $evt.value[props.field.show_id]
      }else{
        show_id.value = model.value
      }
    }
    emit('set-value')
  }

  // Функция для ленивой загрузки следующих порций данных
  const onLazyLoad = async (event) => {
    // Проверяем, что ленивая загрузка разрешена
    if (!pagination.value.allowLazyLoad) return;
    
    // Проверяем, что это действительно запрос на загрузку следующих данных
    // а не инициализация VirtualScroller
    if (pagination.value.loading || !pagination.value.hasMore) return;
    
    // Проверяем, что у нас уже есть данные для загрузки следующих порций
    if (items.value.length === 0 || items.value.length >= pagination.value.total) return;
    
    try {
      pagination.value.loading = true;
      pagination.value.offset += pagination.value.limit;
      
      if(!props.field.ids){
        props.field.ids = ''
      }
      
      const params = {
        query: pagination.value.currentQuery,
        parent: props.field.parent,
        ids: props.field.ids,
        limit: pagination.value.limit,
        offset: pagination.value.offset
      };
      
      // Передаем параметр where, если он указан в поле
      if (props.field.where) {
        params.where = props.field.where;
      }
      
      const response = await api.autocomplete(params);
      items.value = [...items.value, ...response.data.rows];
      pagination.value.total = response.data.total || 0;
      pagination.value.hasMore = items.value.length < pagination.value.total;
    } catch (error) {
      notify('error', { detail: error.message });
    } finally {
      pagination.value.loading = false;
    }
  };
</script>


<style>
  .gts-ac__id-field {
    flex: 0 1 20% !important;
  }

  .gts-ac__search-field input{
    border-top-right-radius: unset;
    border-bottom-right-radius: unset;
  }

  /* Ширина панели AutoComplete по контенту */
  .p-virtualscroller-content {
    position: relative !important;
  }
</style>
