<script setup>
import { PVTabs } from 'pvtables/pvtabs'
import Toast from 'primevue/toast';
import { ref } from 'vue';

console.log('PVTabsConfigs',PVTabsConfigs)
const PVTabsConfig = ref(PVTabsConfigs)
const checkTabs = ref(false)
checkTabs.value = PVTabsConfig?true:false;
</script>

<template>
  <div v-if="checkTabs">
    <PVTabs 
      :tabs="PVTabsConfig"
      :actions="{}"
      :filters="{}"
    />
  </div>
  <p v-else>Табы не заданы!</p>
  <Toast/>
</template>
