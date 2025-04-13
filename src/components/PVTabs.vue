<template>
  <Tabs v-model:value="key0">
    <TabList>
        <Tab v-for="tab in tabs0" :value="tab.key">{{ tab.title }}</Tab>
    </TabList>
    <TabPanels>
      <TabPanel v-for="tab in tabs0" :value="tab.key">
        <UniTree 
          v-if="tab.type=='tree'" 
          :table="tab.table" 
          @select-treenode="selectTreenode"
          :ref="el => { if (el) childComponentRefs[tab.key] = el }"
          />
        <PVFormPanel 
          v-else-if="tab.type=='form'" 
          :table="tab.table" 
          :current_id="current_id" 
          @update-treenode-title="updateTreeNodeTitle"
          :ref="el => { if (el) childComponentRefs[tab.key] = el }"
          />
        <component v-else-if="tab.type=='component'" :is="tab.name_component" :parent_row="parent_row"></component>
        <PVTables 
          v-else
          :table="tab.table"
          :actions="actions"
          :filters="filters[tab.key]"
          :reload="false"
          :key="tab.key"
          @refresh-table="refresh(false)"
          :child="true"
          :ref="el => { if (el) childComponentRefs[tab.key] = el }"
          @get-response="get_response($event)"
        />
      </TabPanel>
    </TabPanels>
  </Tabs>  
  <Toast/>
</template>
<script setup>
  import PVTables from '../PVTables.vue'
  import Toast from 'primevue/toast';
  import { ref, watch } from 'vue';

  import Tabs from 'primevue/tabs';
  import TabList from 'primevue/tablist';
  import Tab from 'primevue/tab';
  import TabPanels from 'primevue/tabpanels';
  import TabPanel from 'primevue/tabpanel';
  import UniTree from './UniTree.vue'
  import PVFormPanel from './PVFormPanel.vue'

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
    parent_row:{
      type: Object,
      default: {},
    },
    current_id:{
      type: [Number,String],
      default: 0
    },
    child:{
      type: Boolean,
      default: false
    }
  });
  const key0 = ref()
  const tabs0 = ref({})
  const childComponentRefs = ref({})
  watch(
    () => props,
    () => {
      tabs0.value = {}
      let failcheck = true
      let key2 = false

      for(let key in props.tabs){
        props.tabs[key].key = key

        if(!key2) key2 = key
        if(!key0.value) key0.value = key
        if(props.tabs[key].active) key0.value = key
        if(key0.value == key) failcheck = false
        // parent_if
        if(!props.tabs[key].hasOwnProperty('parent_if')){
          tabs0.value[key] = { ...props.tabs[key] }
        }else{
          let check = true
          for(let field in props.tabs[key].parent_if){
            if(props.parent_row.hasOwnProperty(field)){
              if(props.tabs[key].parent_if[field] != props.parent_row[field]){
                check = false; break;
              }
            }
          }
          if(check) tabs0.value[key] = { ...props.tabs[key] }
        }
      }
      if(failcheck && key2){
        key0.value = key2
      }
    },{deep:true, immediate: true}
  )
  
  
  // console.log('props.tabs',props.tabs)
  const emit = defineEmits(['refresh-table','get-response','select-treenode','update-treenode-title'])
  const refresh = (from_parent,table) => {
    // console.log('childComponentRefs',childComponentRefs)
    if(!from_parent){
      emit('refresh-table')
      return
    }
    if(table){
      childComponentRefs.value[table].refresh(true,table);
      for(let key in props.tabs){
        childComponentRefs.value[key].refresh(true,table);
      }
    }else{
      for(let key in props.tabs){
        childComponentRefs.value[key].refresh(true);
      }
    }
  };
  defineExpose({ refresh });
  const get_response = (event) => {
    emit('get-response', event)
  }
  const selectTreenode = (event) => {
    emit('select-treenode', event)
  }
  const updateTreeNodeTitle = (event) => {
    emit('update-treenode-title', event)
  }
</script>


