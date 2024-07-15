<template>
  <div class="p-field">
    <label for="doc_id">База 1с</label>
    <GTSAutocomplete
      v-model:id="data.base_id"
      table="doc1cBase"
    />
    <!-- <span  class="p-error">Это поле требуется.</span> -->
  </div>
  <div class="p-field">
    <label for="doc_id">Сокращенный счет</label>
    <InputSwitch v-model="data.sokrashen"/>
    <!-- <span  class="p-error">Это поле требуется.</span> -->
  </div>
  
  <Button
    label="Создать"
    icon="pi pi-check"
    class="p-button-text"
    @click="saveItem"
  />
</template>
<script setup>
  import { ref } from "vue";
  // raschet_id
  // if($data["sokrashen"] == 1){
  // if($base = $this->modx->getObject('doc1cBase',['index'=>$data["base_index"]])){
  // import InputText from "primevue/inputtext";
  import Button from "primevue/button";
  import InputSwitch from "primevue/inputswitch";

  import GTSAutocomplete from "pvtables/gtsautocomplete";

  import apiCtor from 'pvtables/api'
  const api_sraschet = apiCtor('sraschet',600000)
  import { useNotifications } from "pvtables/notify";
  const { notify } = useNotifications();

  const props = defineProps({
    raschet_id: {
      type: String,
      required: true,
    },
  });
  const data = ref({
    raschet_id:props.raschet_id,
    sokrashen:false,
    base_id:'1',
  })
  const emit = defineEmits(['acc-create-on']);
  const saveItem = async () => {
    try {
      if(data.value.sokrashen){
        data.value.sokrashen = 1
      }else{
        data.value.sokrashen = 0
      }
      const resp = await api_sraschet.action('ExcelRaschet/createAccountIn1c',data.value)
      // console.log('resp',resp)
      emit('acc-create-on',resp)
    } catch (error) {
      // console.log('notify3',error)
      notify('error', { detail: error.message });
    }
  };
</script>