<script setup>
import PVTables from '../PVTables.vue'
import Toast from 'primevue/toast';
import { ref } from 'vue';
// import TabView from 'primevue/tabview';
// import TabPanel from 'primevue/tabpanel';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
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
const key0 = ref()
const childComponentRefs = ref({})
for(let key in props.tabs){
  props.tabs[key].key = key
  if(!key0.value) key0.value = key
  if(props.tabs[key].active) key0.value = key
  // childComponentRef.value[key]
}
// console.log('props.tabs',props.tabs)
const refresh = (table) => {
  // console.log('childComponentRefs',childComponentRefs)
  if(table){
    childComponentRefs.value[table].refresh(table);
    for(let key in props.tabs){
      childComponentRefs.value[key].refresh(table);
    }
  }else{
    for(let key in props.tabs){
      childComponentRefs.value[key].refresh();
    }
  }
};
defineExpose({ refresh });
</script>

<template>
  <Tabs :value="key0">
    <TabList>
        <Tab v-for="tab in tabs" :value="tab.key">{{ tab.title }}</Tab>
    </TabList>
    <TabPanels>
      <TabPanel v-for="tab in tabs" :value="tab.key">
        <PVTables 
          :table="tab.table"
          :actions="actions"
          :filters="filters[tab.key]"
          :reload="false"
          :key="tab.key"
          :ref="el => { if (el) childComponentRefs[tab.key] = el }"
        />
      </TabPanel>
    </TabPanels>
  </Tabs>  
  <Toast/>
</template>
