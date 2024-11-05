<template>
  <div :class="{'flex flex-wrap gap-4':inline}">
    <template v-for="col of columns.filter((x) => x.table_only != true)">
      <div class="flex flex-wrap items-center gap-4 mb-4">
        <label :for="col.field" class="font-semibold w-24">{{ col.label }}</label>
        <div :style="{ width: inline?'18rem':'24rem' }">
          <template v-if="col.field == 'id'">
            <span :id="col.field" 
            class="w-full" autocomplete="off">
              {{ model[col.field] }}
            </span>
          </template>
          <template v-else-if="col.type == 'textarea'">
            <Textarea :id="col.field" v-model.trim="model[col.field]" :disabled="col.readonly" 
            class="w-full" autocomplete="off"/>
          </template>
          <template v-else-if="col.type == 'number'">
            <InputNumber :id="col.field" v-model="model[col.field]" :disabled="col.readonly" 
            class="w-full" autocomplete="off"/>
          </template>
          <template v-else-if="col.type == 'autocomplete'">
            <PVAutoComplete
              v-model="model[col.field]"
              :field="col"
              :options="autocompleteSettings[col.field]"
              :disabled="col.readonly"
              class="w-full" autocomplete="off"
            />
          </template>
          <template v-else-if="col.type == 'select'">
            <GTSSelect
              v-model:id="model[col.field]"
              :options="selectSettings2[col.field]?.rows"
              :disabled="col.readonly"
              class="w-full" autocomplete="off"
            />
          </template>
          <template v-else-if="col.type == 'decimal'">
            <InputNumber
              :id="col.field"
              v-model="model[col.field]"
              :minFractionDigits="col.FractionDigits"
              :maxFractionDigits="col.FractionDigits"
              :disabled="col.readonly"
              class="w-full" autocomplete="off"
            />
          </template>
          <template v-else-if="col.type == 'boolean'">
            <ToggleSwitch :id="col.field" v-model="model[col.field]" :disabled="col.readonly"/>
          </template>
          <template v-else-if="col.type == 'date'">
            <GTSDate v-model="model[col.field]" :disabled="col.readonly" 
            class="w-full" autocomplete="off"/>
          </template>
          
          <template v-else>
            <InputText :id="col.field" v-model.trim="model[col.field]" :disabled="col.readonly" 
            class="w-full" autocomplete="off"/>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, watchEffect } from 'vue';
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import InputNumber from "primevue/inputnumber";
import ToggleSwitch from 'primevue/toggleswitch';

import GTSDate from "./gtsDate.vue";
import PVAutoComplete from "./PVAutoComplete.vue";
import GTSSelect from "./gtsSelect.vue";

const model = defineModel({});

const props = defineProps({
  columns: {
    type: Object,
    default: {}
  },
  autocompleteSettings: {
    type: Object,
    default: {}
  },
  selectSettings: {
    type: Object,
    default: {}
  },
  customFields: {
      type: Object,
      default: {},
  },
  inline: {
    type: Boolean,
    default: false
  }
});
const selectSettings2 = ref({})
watchEffect(async () => {
  selectSettings2.value = props.selectSettings
  for(let col in props.columns){
    
    if(props.columns[col].hasOwnProperty('default')){
      if(!model.value.hasOwnProperty(props.columns[col].field)) model.value[props.columns[col].field] = props.columns[col].default
    }
    if(props.columns[col].select_data){
      if(!selectSettings2.value[props.columns[col].field]) selectSettings2.value[props.columns[col].field] = {}
      selectSettings2.value[props.columns[col].field].rows = props.columns[col].select_data
    }
    if (props.customFields.hasOwnProperty(props.columns[col].field)){
      let cf = props.customFields[props.columns[col].field]
      
      props.columns[col] = {...props.columns[col],...cf} //cf
      if(cf.readonly == 1){
        props.columns[col].readonly = true
      }else{
        props.columns[col].readonly = false
      }
      if(cf.select_data){
        if(!selectSettings2.value[props.columns[col].field]) selectSettings2.value[props.columns[col].field] = {}
        selectSettings2.value[props.columns[col].field].rows = cf.select_data
      }
      
    }
    if(props.columns[col].type == 'boolean'){
      if(model.value[props.columns[col].field] == "1") model.value[props.columns[col].field] = true
    }
  }
  
})
</script>
<style>
  .p-inputnumber-input {
    width: 100% !important;
  }
</style>


