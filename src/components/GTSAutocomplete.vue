<template>
  <InputGroup @keydown.tab.stop>
    <InputText v-model="model" @blur="onUserInputEnd" @keydown.enter="onUserInputEnd" @focus="idCache = model" class="gts-ac__id-field"/>
    <AutoComplete
      v-model="selectedItem"
      dropdown
      option-label="content"
      :suggestions="items"
      class="gts-ac__search-field"
      @complete="search"
      @item-select="onAutocompleteItemSelect"
    />
  </InputGroup>
</template>

<script setup>
import AutoComplete from "primevue/autocomplete";
import InputGroup from "primevue/inputgroup";
import { ref, watch, watchEffect } from "vue";
import axios from "axios";
import InputText from "primevue/inputtext";
import { useNotifications } from "../composables/useNotifications";
import apiCtor from '../core/api'


const model = defineModel("id", {
  type: String,
  default: "",
});

const props = defineProps({
  table: {
    type: String,
    required: true,
  },
  options: {
    type: Object,
    default: () => []
  }
});

const api = apiCtor(props.table)

const emit = defineEmits(['update:id', 'set-value']);

const { notify } = useNotifications()

const selectedItem = ref({});

watchEffect(() => {
  const [ option ] = props.options.filter((option) => model.value === option.id)
  if (option) {
    selectedItem.value = option
  } else {
    selectedItem.value = {}
  }
})

const idCache = ref('')
const items = ref([]);

const search = async ({ query }) => {
  // try {
  //   const response = await axios.post(
  //     "/api" + "/" + props.table,
  //     {},
  //     {
  //       params: {
  //         api_action: "autocomplete",
  //         query,
  //       },
  //     }
  //   );

  //   if (!response.data.success) {
  //     throw new Error(response.data.message)
  //   }

  //   items.value = response.data.data.rows;
  // } catch (error) {
  //   notify('error', error.message)
  // }
  try {
    const response = await api.autocomplete({query})
    items.value = response.data.rows;
  } catch (error) {
    notify('error', { detail: error.message });
  }
};

async function getOptionById(id) {
  // const response = await axios.post(
  //   "/api" + "/" + props.table,
  //   {},
  //   {
  //     params: {
  //       api_action: "autocomplete",
  //       id,
  //     },
  //   }
  // );
    
  // if (!response.data.success) {
  //   throw new Error(response.data.message)
  // }

  // return response.data.data.rows[0] || null;
  const response = await api.autocomplete({id})
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
    flex: 0 1 20%;
  }

  .gts-ac__search-field input{
    border-top-right-radius: unset;
    border-bottom-right-radius: unset;
  }
</style>