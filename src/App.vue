<script setup>
import PVTables from './components/PVTables.vue'
</script>

<template>
  <div>
    <PVTables 
      table="tSkladNaryadSmena"
      :actions="{}"
      :filters="{}"
      :reload="false"
    />
  </div>
</template>
