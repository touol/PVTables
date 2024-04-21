<template>
  <InputGroup>
    <InputText v-model="model" @blur="onUserInputEnd" @keydown.enter="onUserInputEnd"/>
    <AutoComplete
      v-model="selectedItem"
      @item-select="onAutocompleteItemSelect"
      dropdown
      @complete="search"
      option-label="content"
      :suggestions="items"
    >
    </AutoComplete>
  </InputGroup>
</template>

<script setup>
import AutoComplete from "primevue/autocomplete";
import InputGroup from "primevue/inputgroup";
import { onBeforeMount, ref } from "vue";
import axios from "axios";
import InputText from "primevue/inputtext";

const model = defineModel("id", {
  type: String,
  default: "",
});

const props = defineProps({
  table: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['update:id', 'set-value']);

const selectedItem = ref({});

const onAutocompleteItemSelect = ($evt) => {
  model.value = $evt.value.id;
  emit('set-value')
}

const items = ref([]);

const search = async ({ query }) => {
  try {
    const response = await axios.post(
      "/api" + "/" + props.table,
      {},
      {
        params: {
          api_action: "autocomplete",
          query,
        },
      }
    );

    items.value = response.data.data.rows;
  } catch (e) {
    console.log("Autocomplete search error: \n", e);
  }
};

async function getOptionById(id) {
  const response = await axios.post(
    "/api" + "/" + props.table,
    {},
    {
      params: {
        api_action: "autocomplete",
        id,
      },
    }
  );

  return response.data.data.rows[0] || null;
}

const falsyModelValues = [null, '', '0']

onBeforeMount(async () => {
  if (!falsyModelValues.includes(model.value)) {
    const option = await getOptionById(model.value);
    selectedItem.value = option;
  }
});

const onUserInputEnd = async ($evt) => {
  const userInput = $evt.target.value

  let option = {}

  if (userInput !== '' && userInput !== '0') {
    option = await getOptionById($evt.target.value);
  }

  selectedItem.value = option
  model.value = userInput

  emit('set-value')
}
</script>
