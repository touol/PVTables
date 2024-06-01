<script setup>
import PVTabs from 'pvtables/pvtabs'
import Toast from 'primevue/toast';
import { computed, ref } from 'vue';

const PVTabsConfig = ref({
  'tSkladNaryadSmena':{
    'title':'tSkladNaryadSmena',
    'table':'tSkladNaryadSmena',
  }, 
  'tSkladSmena':{
    'title':'tSkladSmena',
    'table':'tSkladSmena',
  }
})


</script>

<template>
  <div>
    <PVTabs 
      :tabs="PVTabsConfig"
      :actions="{}"
      :filters="{}"
    />
  </div>
  <Toast/>
</template>
