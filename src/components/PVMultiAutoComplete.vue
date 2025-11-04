<template>
  <div class="multi-autocomplete">
    <!-- Основное поле ID и дополнительные поля поиска в одном InputGroup -->
    <InputGroup @keydown.tab.stop>
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
        :placeholder="field.label"
        :virtualScrollerOptions="{ itemSize: 38, lazy: true }"
      >
      <template v-if="compiledTemplate" #option="{ option, index }">
        <component :is="compiledTemplate" :option="option" :index="index" />
      </template>
      </AutoComplete>
      
      <!-- Дополнительные поля поиска -->
      <AutoComplete
        v-for="(searchField, key) in searchFields" 
        :key="key"
        v-model="searchValues[searchField.key]"
        dropdown
        option-label="content"
        :suggestions="searchSuggestions[searchField.key] || []"
        class="search-field-autocomplete"
        @complete="(event) => searchInField(searchField.key, event)"
        @item-select="(event) => onSearchFieldSelect(searchField.key, event)"
        :disabled="disabled"
        :placeholder="searchField.label || key"
      />
    </InputGroup>
  </div>
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
    currentSearchFilters: {},
    allowLazyLoad: false
  });
  
  // Данные для множественных полей поиска
  const searchValues = ref({});
  const searchSuggestions = ref({});
  const searchFieldsData = ref({});

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

  // Вычисляемое свойство для получения полей поиска из конфигурации
  const searchFields = computed(() => {
    if (!props.field.search || typeof props.field.search !== 'object') {
      return [];
    }
    return Object.entries(props.field.search).map(([key, config]) => ({
      key,
      ...config,
      label: config.label || key
    }));
  });

  // Инициализация полей поиска
  const initSearchFields = async () => {
    for (const searchField of searchFields.value) {
      const key = searchField.key;
      searchValues.value[key] = {};
      searchSuggestions.value[key] = [];
      
      // Загружаем данные по умолчанию для поля
      if (searchField.default_row) {
        try {
          const fieldApi = apiCtor(searchField.table);
          const response = await fieldApi.autocomplete({
            query: '',
            ids: '',
            ...searchField.default_row
          });
          
          searchSuggestions.value[key] = response.data.rows || [];
          
          // Устанавливаем значение по умолчанию
          if (response.data.default) {
            const defaultItem = response.data.rows.find(item => item.id == response.data.default);
            if (defaultItem) {
              searchValues.value[key] = defaultItem;
            }
          }
        } catch (error) {
          notify('error', { detail: `Ошибка загрузки данных для поля ${key}: ${error.message}` });
        }
      }
    }
  };

  // Поиск в конкретном поле
  const searchInField = async (fieldKey, { query }) => {
    const searchField = searchFields.value.find(f => f.key === fieldKey);
    if (!searchField) return;

    try {
      const fieldApi = apiCtor(searchField.table);
      
      // Подготавливаем параметры поиска
      let searchParams = {
        query: query,
        ids: ''
      };

      // Добавляем параметры из конфигурации поля
      if (searchField.distinct) {
        searchParams.distinct = true;
      }

      // Добавляем вложенные поиски
      if (searchField.search) {
        searchParams.search = {};
        for (const [nestedKey, nestedConfig] of Object.entries(searchField.search)) {
          searchParams.search[nestedKey] = nestedConfig;
          
          // Если есть значение в другом поле поиска, используем его
          if (searchValues.value[nestedKey] && searchValues.value[nestedKey].id) {
            searchParams.search[nestedKey].value = searchValues.value[nestedKey].id;
          }
        }
      }

      const response = await fieldApi.autocomplete(searchParams);
      searchSuggestions.value[fieldKey] = response.data.rows || [];
      
    } catch (error) {
      notify('error', { detail: `Ошибка поиска в поле ${fieldKey}: ${error.message}` });
    }
  };

  // Обработка выбора в поле поиска
  const onSearchFieldSelect = async (fieldKey, event) => {
    searchValues.value[fieldKey] = event.value;
    
    // Обновляем зависимые поля
    await updateDependentFields(fieldKey);
    
    // Обновляем основной список
    await updateMainList();
    
    emit('set-value');
  };

  // Обновление зависимых полей
  const updateDependentFields = async (changedFieldKey) => {
    for (const searchField of searchFields.value) {
      const fieldKey = searchField.key;
      
      // Пропускаем само изменившееся поле
      if (fieldKey === changedFieldKey) continue;
      
      // Проверяем, зависит ли это поле от изменившегося
      if (searchField.search && searchField.search[changedFieldKey]) {
        // Очищаем текущие предложения
        searchSuggestions.value[fieldKey] = [];
        
        // Загружаем новые данные с учетом изменения
        await searchInField(fieldKey, { query: '' });
      }
    }
  };

  // Обновление основного списка с учетом выбранных фильтров
  const updateMainList = async () => {
    try {
      let searchParams = {
        query: '',
        ids: ''
      };

      // Добавляем фильтры из выбранных значений в полях поиска через параметр search
      const searchFilters = {};
      for (const [fieldKey, value] of Object.entries(searchValues.value)) {
        if (value && value.id) {
          searchFilters[fieldKey] = { value: value.id };
        }
      }
      
      if (Object.keys(searchFilters).length > 0) {
        searchParams.search = searchFilters;
      }

      const response = await api.autocomplete(searchParams);
      items.value = response.data.rows || [];
      
    } catch (error) {
      notify('error', { detail: `Ошибка обновления основного списка: ${error.message}` });
    }
  };

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

  onMounted(async () => {
    await default_row();
    await initSearchFields();
  });

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
        
        // Автоматически заполняем поля поиска на основе выбранного значения
        await fillSearchFieldsFromOption(option);
      }
    }else if(Number(model.value) > 0){
      try {
        const option = await getOptionById(model.value);

        if (!option) {
          notify('error', { detail: 'Отсутствует такой ID' })
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
        
        // Автоматически заполняем поля поиска на основе выбранного значения
        await fillSearchFieldsFromOption(option);
      } catch (error) {
        notify('error', { detail: error.message })
      }
    }
    
    // Заполняем поля поиска из данных autocomplete API
    if (props.options && props.options.searchFields) {
      for (const [fieldKey, fieldData] of Object.entries(props.options.searchFields)) {
        if (fieldData.rows && fieldData.rows.length > 0) {
          searchSuggestions.value[fieldKey] = fieldData.rows;
          
          // Если есть только одно значение, автоматически выбираем его
          if (fieldData.rows.length === 1) {
            searchValues.value[fieldKey] = fieldData.rows[0];
          }
        }
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
      
      // Добавляем фильтры из полей поиска
      let searchParams = {
        query: query,
        parent: props.field.parent,
        ids: props.field.ids,
        limit: pagination.value.limit,
        offset: pagination.value.offset
      };

      // Передаем параметр where, если он указан в поле
      if (props.field.where) {
        searchParams.where = props.field.where;
      }

      // Добавляем значения из полей поиска через параметр search
      const searchFilters = {};
      for (const [fieldKey, value] of Object.entries(searchValues.value)) {
        if (value && value.id) {
          searchFilters[fieldKey] = { value: value.id };
        }
      }
      
      if (Object.keys(searchFilters).length > 0) {
        searchParams.search = searchFilters;
      }
      
      // Сохраняем текущие фильтры поиска для ленивой загрузки
      pagination.value.currentSearchFilters = searchFilters;

      const response = await api.autocomplete(searchParams);
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
      
      const searchParams = {
        query: pagination.value.currentQuery,
        parent: props.field.parent,
        ids: props.field.ids,
        limit: pagination.value.limit,
        offset: pagination.value.offset
      };
      
      // Передаем параметр where, если он указан в поле
      if (props.field.where) {
        searchParams.where = props.field.where;
      }
      
      // Добавляем сохраненные фильтры поиска
      if (Object.keys(pagination.value.currentSearchFilters).length > 0) {
        searchParams.search = pagination.value.currentSearchFilters;
      }
      
      const response = await api.autocomplete(searchParams);
      items.value = [...items.value, ...response.data.rows];
      pagination.value.total = response.data.total || 0;
      pagination.value.hasMore = items.value.length < pagination.value.total;
    } catch (error) {
      notify('error', { detail: error.message });
    } finally {
      pagination.value.loading = false;
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
  
  // Функция для автоматического заполнения полей поиска на основе выбранного значения
  const fillSearchFieldsFromOption = async (option) => {
    for (const searchField of searchFields.value) {
      const fieldKey = searchField.key;
      
      // Если в выбранном объекте есть значение для этого поля поиска
      if (option[fieldKey] && option[fieldKey] !== null && option[fieldKey] !== '') {
        try {
          const fieldApi = apiCtor(searchField.table);
          const response = await fieldApi.autocomplete({
            id: option[fieldKey]
          });
          
          if (response.data.rows && response.data.rows.length > 0) {
            const searchFieldOption = response.data.rows[0];
            searchValues.value[fieldKey] = searchFieldOption;
            
            // Добавляем в предложения если его там нет
            if (!searchSuggestions.value[fieldKey]) {
              searchSuggestions.value[fieldKey] = [];
            }
            
            const existingIndex = searchSuggestions.value[fieldKey].findIndex(item => item.id === searchFieldOption.id);
            if (existingIndex === -1) {
              searchSuggestions.value[fieldKey].push(searchFieldOption);
            }
          }
        } catch (error) {
          console.error(`Ошибка загрузки данных для поля ${fieldKey}:`, error);
        }
      }
    }
  };
  
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
    if(props.field.show_id){
      if($evt.value[props.field.show_id]){
        show_id.value = $evt.value[props.field.show_id]
      }else{
        show_id.value = model.value
      }
    }
    emit('set-value')
  }
</script>

<style scoped>
  .multi-autocomplete {
    width: 100%;
  }

  .gts-ac__id-field {
    flex: 0 1 15% !important;
  }

  .search-field-autocomplete {
    flex: 0 1 40% !important;
  }

  .gts-ac__search-field {
    flex: 1 !important;
  }

  .gts-ac__search-field input{
    border-top-right-radius: unset;
    border-bottom-right-radius: unset;
  }
</style>
