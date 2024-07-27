<script setup>
import PVTables from '../PVTables.vue'
import Toast from 'primevue/toast';
import { ref } from 'vue';

// console.log('PVTableConfigTable',PVTableConfigTable)
const currentTable = ref(PVTableConfigTable)
const checkTable = ref(false)
checkTable.value = PVTableConfigTable?true:false;
</script>

<template>
  <div v-if="checkTable">
    <PVTables 
      :table="currentTable"
      :actions="{}"
      :filters="{}"
      :reload="false"
      :key="currentTable"
    />
  </div>
  <p v-else>Таблица не задана!</p>
  <Toast/>
</template>
