<template>
  <template v-for="col of columns.filter((x) => x.table_only != true)">
    <div class="flex items-center gap-4 mb-4">
      <label :for="col.field" class="font-semibold w-24">{{ col.label }}</label>
      <template v-if="col.field == 'id'">
        <span :id="col.field" class="flex-auto" autocomplete="off">{{ model[col.field] }}</span>
      </template>
      <template v-else-if="col.type == 'textarea'">
        <Textarea :id="col.field" v-model.trim="model[col.field]" :disabled="col.readonly" class="flex-auto" autocomplete="off"/>
      </template>
      <template v-else-if="col.type == 'number'">
        <InputNumber :id="col.field" v-model="model[col.field]" :disabled="col.readonly" class="flex-auto" autocomplete="off"/>
      </template>
      <template v-else-if="col.type == 'autocomplete'">
        <GTSAutocomplete
          v-model:id="model[col.field]"
          :table="col.table"
          :options="autocompleteSettings[col.field]"
          :disabled="col.readonly"
            class="flex-auto" autocomplete="off"
        />
      </template>
      <template v-else-if="col.type == 'select'">
        <GTSSelect
          v-model:id="model[col.field]"
          :options="selectSettings[col.field]?.rows"
          :disabled="col.readonly"
            class="flex-auto" autocomplete="off"
        />
      </template>
      <template v-else-if="col.type == 'decimal'">
        <InputNumber
          :id="col.field"
          v-model="model[col.field]"
          :minFractionDigits="col.FractionDigits"
          :maxFractionDigits="col.FractionDigits"
          :disabled="col.readonly"
            class="flex-auto" autocomplete="off"
        />
      </template>
      <template v-else-if="col.type == 'boolean'">
        <ToggleSwitch :id="col.field" v-model="model[col.field]" :disabled="col.readonly"/>
      </template>
      <GTSDate v-else-if="col.type === 'date'" v-model="model[col.field]" :disabled="col.readonly" class="flex-auto" autocomplete="off"/>
      <template v-else>
        <InputText :id="col.field" v-model.trim="model[col.field]" :disabled="col.readonly" class="flex-auto" autocomplete="off"/>
      </template>
    </div>
  </template>
</template>

<script setup>
import { ref, watch, watchEffect } from 'vue';
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import InputNumber from "primevue/inputnumber";
import ToggleSwitch from 'primevue/toggleswitch';

import GTSDate from "./gtsDate.vue";
import GTSAutocomplete from "./gtsAutoComplete.vue";
import GTSSelect from "./gtsSelect.vue";

const model = defineModel();

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
  }
});
watchEffect(async () => {
  for(let col in props.columns){
    if(props.columns[col].hasOwnProperty('default')){
      if(!model.value.hasOwnProperty(props.columns[col].field)) model.value[props.columns[col].field] = props.columns[col].default
    }
  }
})
</script>


