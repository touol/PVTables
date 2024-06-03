<script setup>
import { PVTables } from 'pvtables/pvtables'
import Toast from 'primevue/toast';
import { computed, ref } from 'vue';

const childComponentRef = ref()
const actions = ref({
  // 'tSkladNaryadSmena':{
  //   delete:{
  //     head:true,
  //     icon:"pi pi-trash",
  //     class:"p-button-rounded p-button-danger",
  //     head_click: (data,colomns) => {
  //       // console.log('delete',data,colomns)
  //       childComponentRef.value.refresh('tSkladSmena');
  //     }
  //   }
  // }
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
