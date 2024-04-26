<script setup>
import PVTables from './components/PVTables.vue'
import Toast from 'primevue/toast';
import { useToast } from "primevue/usetoast";

const toast = useToast()

const showToast = (msgObj = {}) => toast.add(msgObj)
</script>

<template>
  <div>
    <PVTables 
      table="tSkladNaryadSmena"
      :actions="{}"
      :filters="{}"
      :reload="false"
      @message="showToast"
    />
  </div>
  <Toast/>
</template>
