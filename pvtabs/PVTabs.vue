<script setup>
import { PVTables } from 'pvtables/pvtables'
import Toast from 'primevue/toast';
import { ref } from 'vue';
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
const childComponentRefs = ref({})
for(let key in props.tabs){
  props.tabs[key].key = key
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
  <TabView>
    <TabPanel v-for="tab in tabs" :key="tab.key" :header="tab.title">
      <PVTables 
        :table="tab.table"
        :actions="actions"
        :filters="filters[tab.key]"
        :reload="false"
        :key="tab.key"
        :ref="el => { if (el) childComponentRefs[tab.key] = el }"
      />
    </TabPanel>
  </TabView>  
  <Toast/>
</template>
