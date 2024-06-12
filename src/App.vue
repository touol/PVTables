<script setup>
import { PVTables } from 'pvtables/pvtables'
import Toast from 'primevue/toast';
import { computed, ref } from 'vue';

const childComponentRef = ref()
const actions = ref({
  DocOrderLink:{
    create:{
      row:true,
      icon:"pi pi-plus",
      class:"p-button-rounded p-button-danger",
      head_click: (event,table,filters,selectedlineItems) => {
        console.log('create',event,table,filters,selectedlineItems)
        
        childComponentRef.value.refresh('DocOrderLink');
      }
    }
  }
})

</script>

<template>
  <div>
    <PVTables 
      table="sraschet"
      :actions="actions"
      :filters="{}"
      ref="childComponentRef"
    />
  </div>
  <Toast/>
</template>
