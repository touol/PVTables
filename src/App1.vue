<script setup>
import { PVTabs } from 'pvtables/pvtabs'
import Toast from 'primevue/toast';
import { computed, ref } from 'vue';

const PVTabsConfig = ref({
  'tSkladNaryadSmena':{
    'title':'tSkladNaryadSmena',
    'table':'tSkladNaryadSmena'
  }, 
  'tSkladSmena':{
    'title':'tSkladSmena',
    'table':'tSkladSmena'
  }
})
const childComponentRef = ref()
const actions = ref({
  'tSkladNaryadSmena':{
    delete:{
      head:true,
      icon:"pi pi-trash",
      class:"p-button-rounded p-button-danger",
      head_click: (data,colomns) => {
        // console.log('delete',data,colomns)
        childComponentRef.value.refresh('tSkladSmena');
      }
    }
  }
})

</script>

<template>
  <div>
    <PVTabs 
      :tabs="PVTabsConfig"
      :actions="actions"
      :filters="{}"
      ref="childComponentRef"
    />
  </div>
  <Toast/>
</template>
