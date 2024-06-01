<script setup>
import { PVTables } from 'pvtables/pvtables'
import Toast from 'primevue/toast';
// import { ref } from 'vue';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';

const props = defineProps({
  tabs: {
    type: Object,
    required: true,
  },
  actions: {
    type: Object,
    default: {},
  },
  filters: {
    type: Object,
    default: {},
  },
});
</script>

<template>
  <TabView>
    <TabPanel v-for="tab in tabs" :key="tab.title" :header="tab.title">
      <PVTables 
        :table="tab.table"
        :actions="actions"
        :filters="filters"
        :reload="false"
        :key="tab.table"
      />
    </TabPanel>
  </TabView>  
  <Toast/>
</template>
