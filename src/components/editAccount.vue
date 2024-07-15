<template>
  <div class="p-field">
    <label for="doc_id">База 1с</label>
    <GTSAutocomplete
      v-model:id="model.base_id"
      table="doc1cBase"
    />
    <!-- <span  class="p-error">Это поле требуется.</span> -->
  </div>
  <div class="p-field">
    <label for="doc_id">Период</label>
    <GTSAutocomplete
      v-model:id="model.period_id"
      table="gtsBPeriod"
      :options="items_gtsBPeriod"
    />
    <!-- <span  class="p-error">Это поле требуется.</span> -->
  </div>
  <div class="p-field">
    <label for="doc_id">Номер счета</label>
    <InputText
      v-model="model.nomer_1c"
    />
    <!-- <span  class="p-error">Это поле требуется.</span> -->
  </div>
  <div class="p-field">
    <label for="doc_id">Номер счета полный</label>
    <InputText
      v-model="model.nomer_1c_str"
    />
    <!-- <span  class="p-error">Это поле требуется.</span> -->
  </div>
  <div class="p-field">
    <label for="doc_id">Дата счета</label>
    <GTSDate
      v-model="model.date_1c"
    />
    <!-- <span  class="p-error">Это поле требуется.</span> -->
  </div>
</template>
<script setup>
  import { ref, onMounted } from "vue";
  // raschet_id
  // if($data["sokrashen"] == 1){
  // if($base = $this->modx->getObject('doc1cBase',['index'=>$data["base_index"]])){
  import InputText from "primevue/inputtext";
  // import Button from "primevue/button";
  // import InputSwitch from "primevue/inputswitch";

  import GTSAutocomplete from "pvtables/gtsautocomplete";
  import GTSDate from "pvtables/gtsdate";

  import apiCtor from 'pvtables/api'
  // const api_doc1cBase = apiCtor('doc1cBase')
  const api_gtsBPeriod = apiCtor('gtsBPeriod')

  import { useNotifications } from "pvtables/notify";
  const { notify } = useNotifications();

  const model = defineModel({
    type: Object,
    default: {
      base_id:'1',
      period_id:'',
      nomer_1c:'',
      nomer_1c_str:'',
      date_1c:'',
      file:''
    },
  });
  const items_gtsBPeriod = ref([])
  onMounted(async () => {
    try {
      const response = await api_gtsBPeriod.autocomplete()
      items_gtsBPeriod.value = response.data.rows;
      // console.log('model',model)
      if(!model.value.period_id) model.value.period_id = response.data.default.toString();
    } catch (error) {
      // console.log('error',error)
      notify('error', { detail: error.message });
    }
  })
  
</script>