<template>
  <InputGroup @keydown.tab.stop>
    <InputText v-model="model" @blur="onUserInputEnd" @keydown.enter="onUserInputEnd" @focus="idCache = model" class="gts-ac__id-field"
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
import { readonly, ref, watch, watchEffect } from "vue";
import InputText from "primevue/inputtext";
import { useNotifications } from "./useNotifications.js";
import apiCtor from './api.js'

const model = defineModel("id", {
  type: [String,Number],
  default: "",
});

const props = defineProps({
  table: {
    type: String,
    required: true,
  },  
  disabled: {
    type: Boolean,
    default: false,
  },
  options: {
    type: Object,
    default: () => []
  },
  parent: {
    type: Object,
    default: () => {}
  }
});

const api = apiCtor(props.table)
const emit = defineEmits(['update:id', 'set-value']);

const { notify } = useNotifications()

const selectedItem = ref({});

watchEffect(async () => {
  if (Number(model.value) == 0 && Number(props.options.default) > 0){
    model.value = props.options.default
  }
  if (props.options && Array.isArray(props.options.rows) && props.options.length) {
    const [ option ] = props.options.rows.filter((option) => model.value === option.id)
    if (option) {
      selectedItem.value = option
    } else {
      selectedItem.value = {}
    }
  }else if(Number(model.value) > 0){
    try {
      const option = await getOptionById(model.value);

      if (!option) {
        notify('error', { detail: 'Отсутствует такой ID' })
        return
      }

      selectedItem.value = option
    } catch (error) {
      notify('error', { detail: error.message })
    }
  }
})

const idCache = ref('')
const items = ref([]);

const search = async ({ query }) => {
  try {
    const response = await api.autocomplete({query:query,parent:props.parent})
    items.value = response.data.rows;
  } catch (error) {
    notify('error', { detail: error.message });
  }
};

async function getOptionById(id) {
  const response = await api.autocomplete({id:id,parent:props.parent})
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
  } catch (error) {
    notify('error', { detail: error.message })
  }

  emit('set-value')
}

const onAutocompleteItemSelect = ($evt) => {
  model.value = $evt.value.id;
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