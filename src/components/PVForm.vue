<template>
  <div :class="{'flex flex-wrap gap-4':inline}">
    <template v-for="col of columns2.filter((x) => x.table_only != true && x.type != 'hidden')">
      <div class="flex flex-wrap items-center gap-4 mb-4">
        <label :for="col.field" class="font-semibold w-24">{{ col.label }}</label>
        <div :style="{ width: inline?'18rem':'24rem' }">
          <EditField
            :field="col"
            v-model="model[col.field]"
            :data="model"
            :use_data="true"
            :autocompleteSettings="autocompleteSettings[col.field]"
            :selectSettings="selectSettings2[col.field]"
            @set-value="setValue()"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watchEffect, watch } from 'vue';
import EditField from "./EditField.vue";
import apiCtor from './api.js'
import { useNotifications } from "./useNotifications";

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
  },
  mywatch: {
    type: Object,
    default: {
      enabled: false,
      fields: [],
      filters: {},
      table: '',
      action: ''
    }
  }
});
const selectSettings2 = ref({})
const columns2 = ref({})
let stop_watch_props = false
const emit = defineEmits(['set-value']);
const setValue = () => {
  emit('set-value', model.value)
}
watchEffect(async () => {
  if(stop_watch_props) return
  // console.log('watch1',columns2.value)
  selectSettings2.value = JSON.parse(JSON.stringify(props.selectSettings)) //props.selectSettings
  columns2.value = JSON.parse(JSON.stringify(props.columns)) //props.columns
  for(let col in columns2.value){
    
    if(columns2.value[col].hasOwnProperty('default')){
      if(!model.value.hasOwnProperty(columns2.value[col].field)) model.value[columns2.value[col].field] = columns2.value[col].default
    }
    if(columns2.value[col].select_data){
      if(!selectSettings2.value[columns2.value[col].field]) selectSettings2.value[columns2.value[col].field] = {}
      selectSettings2.value[columns2.value[col].field].rows = columns2.value[col].select_data
    }
    if (props.customFields.hasOwnProperty(columns2.value[col].field)){
      let cf = props.customFields[columns2.value[col].field]
      
      columns2.value[col] = {...columns2.value[col],...cf} //cf
      if(cf.readonly == 1){
        columns2.value[col].readonly = true
      }else{
        columns2.value[col].readonly = false
      }
      if(cf.select_data){
        if(!selectSettings2.value[columns2.value[col].field]) selectSettings2.value[columns2.value[col].field] = {}
        selectSettings2.value[columns2.value[col].field].rows = cf.select_data
      }
      
    }
    if(columns2.value[col].type == 'boolean'){
      if(model.value[columns2.value[col].field] == "1") model.value[columns2.value[col].field] = true
    }
  }
  
})
let watchOld = {}
let watch_first = true

const api = apiCtor(props.mywatch.table)
const { notify } = useNotifications();

const watch_form = async (values, field, value, oldValue) => {
  try {
    // console.log('values',values)
    const response = await api.action('watch_form', {
      filters:props.mywatch.filters,
      watch_action:props.mywatch.action, 
      values:values, 
      field:field, 
      value:value, 
      oldValue:oldValue
    })
    // console.log('response',response)
    if (!response.success) {
      notify('error', { detail: response.message }, true);
      return
    }
    if(response.data.fields){
      stop_watch_props = true
      let cols = [];
      let fields = response.data.fields
      for (let field in fields) {
        fields[field].field = field;
        if (!fields[field].hasOwnProperty("label")) {
          fields[field].label = field;
        }
        if (!fields[field].hasOwnProperty("type")) fields[field].type = "text";
        if (fields[field].hasOwnProperty("readonly")){
          if(fields[field].readonly === true || fields[field].readonly == 1){
            fields[field].readonly = true
          }else{
            fields[field].readonly = false
          }
        }
        if(fields[field].select_data){ 
          if(!selectSettings2.value[field]) selectSettings2.value[field] = {}
          selectSettings2.value[field].rows = fields[field].select_data
        }
        cols.push(fields[field]);
      }
      columns2.value = cols
      for(let col in columns2.value){
        if(columns2.value[col].hasOwnProperty('default')){
          if(!model.value[columns2.value[col].field]) model.value[columns2.value[col].field] = columns2.value[col].default
        }
      }
    }
  } catch (error) {
    notify('error', { detail: error.message }, true);
  }
}
if(props.mywatch.enabled){
  watch(model, () => {
    props.mywatch.fields.forEach(field => {
      if((watch_first && model.value[field]) || model.value[field] != watchOld[field]){
        watch_form(model.value,field,model.value[field],watchOld[field])
      }

    })
    watch_first = false
    watchOld = JSON.parse(JSON.stringify(model.value))
  }, {deep: true, immediate: true})
}
</script>
<style>
  .p-inputnumber-input {
    width: 100% !important;
  }
</style>


