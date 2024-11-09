<template>
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
      :disabled="disabled"
    />
  </InputGroup>
</template>

<script setup>
  import AutoComplete from "primevue/autocomplete";
  import InputGroup from "primevue/inputgroup";
  import { ref, watchEffect } from "vue";
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
    parent: {
      type: Object,
      default: () => {}
    }
  });

  const api = apiCtor(props.field.table)
  const emit = defineEmits(['update:id', 'set-value']);

  const { notify } = useNotifications()

  const selectedItem = ref({});

  watchEffect(async () => {
    if (props.options && Number(model.value) == 0 && Number(props.options.default) > 0){
      model.value = props.options.default
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
      } catch (error) {
        notify('error', { detail: error.message })
      }
    }
  })

  const idCache = ref('')
  const items = ref([]);

  const search = async ({ query }) => {
    try {
      if(!props.field.ids){
        props.field.ids = ''
      }
      const response = await api.autocomplete({query:query,parent:props.parent,ids:props.field.ids})
      items.value = response.data.rows;
    } catch (error) {
      notify('error', { detail: error.message });
    }
  };

  async function getOptionById(id) {
    const response = await api.autocomplete({id:id,parent:props.parent})
    return response.data.rows[0] || null;
  }
  async function getOptionByShowId(show_id) {
    const response = await api.autocomplete({show_id:show_id,parent:props.parent})
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
</script>


<style>
  .gts-ac__id-field {
    flex: 0 1 20% !important;
  }

  .gts-ac__search-field input{
    border-top-right-radius: unset;
    border-bottom-right-radius: unset;
  }
</style>