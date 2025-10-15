<template>
  <span v-if="styleShow">{{ selectedItem.content }}</span>
  <AutoComplete
    v-else
    v-model="selectedItem"
    dropdown
    option-label="content"
    :suggestions="items"
    @complete="search"
    @item-select="onAutocompleteItemSelect"
    @hide="onHide"
    :disabled="disabled"
    :panelStyle="{ width: 'auto' }"
    :overlayStyle="{ width: 'auto' }"
  />
</template>

<script setup>
import AutoComplete from "primevue/autocomplete";
import { ref, watchEffect } from "vue";

const model = defineModel("id", {
  type: [String,Number],
  default: "",
});

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  options: {
    type: Object,
    default: () => []
  },
  styleShow: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:id', 'set-value']);

const selectedItem = ref({});

watchEffect(() => {
  const [ option ] = props.options.filter((option) => model.value == option.id)
  if (option) {
    selectedItem.value = option
    
  } else {
    selectedItem.value = {}
  }
})

const items = ref([]);

const search = async ({ query }) => {
  if(query && query !== 0){
    items.value = props.options.filter((option) => option.content.indexOf(query) !=-1);
  }else{
    items.value = props.options
  }
};


const onAutocompleteItemSelect = ($evt) => {
  items.value = []
  model.value = $evt.value.id.toString();
  emit('set-value')
}
const onHide = () => {
  items.value = []
}

</script>
<style>
  /* Ширина панели AutoComplete по контенту */
  .p-virtualscroller-content {
    position: relative !important;
  }
</style>