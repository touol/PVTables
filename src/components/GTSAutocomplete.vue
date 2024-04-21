<template>
  <InputGroup @keydown.stop>
    <InputText
      v-model="model"   
    />
    <AutoComplete v-model="selectedItem" dropdown @complete="search" option-label="content" :suggestions="items">

    </AutoComplete>
    <!-- <Button label="Поиск"/> -->
  </InputGroup>
</template>

<script setup>
import AutoComplete from 'primevue/autocomplete';
// import Button from 'primevue/button'
import InputGroup from 'primevue/inputgroup'
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import axios from 'axios';
import InputText from 'primevue/inputtext';

const model = defineModel('id', {
  type: String,
  default: ''
})

const props = defineProps({
  table: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:id'])

const selectedItem = ref({});

watch(selectedItem, (val) => {
  model.value = val.id
})



const items = ref([]);

const search = async ({ query }) => {
  try {
    const response = await axios.post('/api' + '/' + props.table, {}, {
      params: {
        'api_action': 'autocomplete',
         query
      }
    });

    items.value = response.data.data.rows
    // console.log(response)  
  } catch (e) {
    console.log('Autocomplete search error: \n', e)
  }
}

async function getInitialOption(id) {
  const response = await axios.post('/api' + '/' + props.table, {}, {
    params: {
      'api_action': 'autocomplete',
      id
    }
  })

  return response.data.data.rows[0]
}

onBeforeMount(async () => {
  if (model.value === '0') {
    model.value = ''
  }

  if (model.value !== '' && model.value !== '0') {
    const option = await getInitialOption(model.value);
    selectedItem.value = option
  }
})
</script>