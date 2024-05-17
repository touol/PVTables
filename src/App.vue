<script setup>
import Button from 'primevue/button';
import PVTables from './components/PVTables.vue'
import Toast from 'primevue/toast';
import { computed, ref } from 'vue';

const possibleTables = computed(() => ['tSkladNaryadSmena', 'tSkladSmena'])

const currentTable = ref('tSkladNaryadSmena')

const switchTable = (tableName) => {
  currentTable.value = tableName
}
</script>

<template>
  <div>
    <Button 
      v-for="tableName in possibleTables"
      :label="tableName"
      severity="info"
      @click="switchTable(tableName)"
    />
  </div>
  <div>
    <PVTables 
      :table="currentTable"
      :actions="{}"
      :filters="{}"
      :reload="false"
      :key="currentTable"
    />
  </div>
  <Toast/>
</template>
