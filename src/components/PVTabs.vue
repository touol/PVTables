<template>
  <Tabs v-model:value="key0" ref="tabsRef">
    <TabList>
        <Tab v-for="tab in tabs0" :value="tab.key">{{ tab.title }}</Tab>
    </TabList>
    <TabPanels ref="tabPanelsRef">
      <TabPanel v-for="tab in tabs0" :value="tab.key">
        <UniTree 
          v-if="tab.type=='tree'" 
          :table="tab.table"
          :dragable="tab.dragable" 
          @select-treenode="selectTreenode"
          :ref="el => { if (el) childComponentRefs[tab.key] = el }"
          />
        <FileTree 
          v-else-if="tab.type=='filetree'" 
          :mediaSources="tab.mediaSources"
          @select-file="selectFile"
          :ref="el => { if (el) childComponentRefs[tab.key] = el }"
          />
        <FileContent 
          v-else-if="tab.type=='filecontent'" 
          :file="tab.file"
          :content="tab.content"
          :mime="tab.mime"
          :mediaSources="tab.mediaSources"
          :ref="el => { if (el) childComponentRefs[tab.key] = el }"
          />
        <PVFormPanel 
          v-else-if="tab.type=='form'" 
          :table="tab.table" 
          :current_id="current_id" 
          @update-treenode-title="updateTreeNodeTitle"
          :ref="el => { if (el) childComponentRefs[tab.key] = el }"
          />
        <FileGallery 
          v-else-if="tab.type=='file-gallery'" 
          :title="tab.title"
          :parent-id="current_id"
          :parent-class="class_key"
          :list-name="tab.list_name"
          :allow-upload="true"
          :allow-edit="true"
          :allow-delete="true"
          :show-filters="true"
          :page-size="20"
          :ref="el => { if (el) childComponentRefs[tab.key] = el }"
          />
        <div v-else-if="tab.type=='component'">
          <component
            :is="resolveComponentName(tab.name_component)"
            :parent_row="parent_row"
            :parent-id="current_id"
            :filters="filters[tab.key]"
            :sorting="sorting[tab.key] || []"
            @refresh="refresh(false)"
            :ref="el => { if (el) childComponentRefs[tab.key] = el }"
          ></component>
        </div>
        <template v-else-if="tab.type=='tables'">
          <PVTables
            v-for="table in tab.tables"
            :table="table.table"
            :actions="actions"
            :filters="filters[table.key]"
            :sorting="sorting[table.key] || []"
            :reload="false"
            :key="table.key"
            @refresh-table="refresh(false)"
            :child="true"
            :scrollHeight="tableScrollHeights[table.key] || '400px'"
            :ref="el => { if (el) childComponentRefs[table.key] = el }"
            @get-response="get_response($event)"
          />
        </template>
        <PVTables
          v-else
          :table="tab.table"
          :actions="actions"
          :filters="filters[tab.key]"
          :sorting="sorting[tab.key] || []"
          :reload="false"
          :key="tab.key"
          @refresh-table="refresh(false)"
          :child="true"
          :scrollHeight="tableScrollHeights[tab.key] || '400px'"
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
  import { ref, watch, resolveComponent, onErrorCaptured, nextTick, onMounted, onBeforeUnmount } from 'vue';

  import Tabs from 'primevue/tabs';
  import TabList from 'primevue/tablist';
  import Tab from 'primevue/tab';
  import TabPanels from 'primevue/tabpanels';
  import TabPanel from 'primevue/tabpanel';
  import UniTree from './UniTree.vue'
  import FileTree from './FileTree.vue'
  import FileContent from './FileContent.vue'
  import PVFormPanel from './PVFormPanel.vue'
  import FileGallery from './gtsAPIFileGallery/FileGallery.vue'

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
    sorting: {
      type: Object,
      default: {}
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
    },
    class_key:{
      type: [String],
      default: ''
    }
  });
  const key0 = ref()
  const tabs0 = ref({})
  const childComponentRefs = ref({})
  const tabsRef = ref(null)
  const tabPanelsRef = ref(null)
  const tableScrollHeights = ref({})
  
  /**
   * Расчет высоты scrollHeight для таблиц
   * @param {Number} tablesCount - количество таблиц во вкладке
   * @returns {String} - высота в формате '400px'
   */
  const calculateTableScrollHeight = (tablesCount = 1) => {
    if (!tabPanelsRef.value) return '400px'
    
    try {
      const windowHeight = window.innerHeight
      const tabPanelsEl = tabPanelsRef.value.$el || tabPanelsRef.value
      if (!tabPanelsEl) return '400px'
      
      const rect = tabPanelsEl.getBoundingClientRect()
      const tabPanelsTop = rect.top
      
      const bottomPadding = 0
      const toolbarHeight = 50
      const headerHeight = 50
      const paginatorHeight = 50
      const gapBetweenTables = tablesCount > 1 ? 0 * (tablesCount - 1) : 0
      const additionalPadding = 0
      
      const availableHeight = windowHeight - tabPanelsTop - bottomPadding - additionalPadding
      const heightPerTable = (availableHeight - gapBetweenTables) / tablesCount
      const scrollHeight = heightPerTable - toolbarHeight - headerHeight - paginatorHeight
      const finalHeight = Math.max(200, scrollHeight)
      
      return `${Math.floor(finalHeight)}px`
    } catch (error) {
      console.error('Error calculating table scroll height:', error)
      return '400px'
    }
  }
  
  /**
   * Обновление высот для всех таблиц в текущей вкладке
   */
  const updateTableHeights = async () => {
    await nextTick()
    
    const currentTab = tabs0.value[key0.value]
    if (!currentTab) return
    
    let tablesCount = 0
    
    if (currentTab.type === 'tables' && currentTab.tables) {
      tablesCount = Object.keys(currentTab.tables).length
    } else if (currentTab.table) {
      tablesCount = 1
    }
    
    if (tablesCount > 0) {
      const scrollHeight = calculateTableScrollHeight(tablesCount)
      
      if (currentTab.type === 'tables' && currentTab.tables) {
        for (let tableKey in currentTab.tables) {
          tableScrollHeights.value[tableKey] = scrollHeight
        }
      } else if (currentTab.key) {
        tableScrollHeights.value[currentTab.key] = scrollHeight
      }
    }
  }
  
  // Функция для резолва динамических компонентов
  const resolveComponentName = (componentName) => {
    if (!componentName) {
      console.error('PVTabs: componentName is empty')
      return null
    }
    try {
      // Пытаемся резолвить компонент
      const component = resolveComponent(componentName)
      if (!component || component === componentName) {
        console.error(`PVTabs: Component "${componentName}" not found. Make sure it's globally registered or imported.`)
        return null
      }
      return component
    } catch (error) {
      console.error(`PVTabs: Error resolving component "${componentName}":`, error)
      return null
    }
  }
  
  
  // Перехват ошибок рендеринга
  onErrorCaptured((err, instance, info) => {
    console.error('PVTabs: Error captured:', {
      error: err,
      component: instance?.$options?.name || 'Unknown',
      info: info
    })
    return false // Продолжаем всплытие ошибки
  })
  
  // Следим за изменением активной вкладки
  watch(key0, () => {
    updateTableHeights()
  })
  
  // Lifecycle hooks
  onMounted(() => {
    window.addEventListener('resize', updateTableHeights)
    updateTableHeights()
  })
  
  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateTableHeights)
  })
  
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
        if(props.tabs[key].type == 'tables'){
          for(let table_key in props.tabs[key].tables){
            tabs0.value[key].tables[table_key].key = table_key
          }
        }
      }
      if(failcheck && key2){
        key0.value = key2
      }
    },{deep:true, immediate: true}
  )
  
  
  // console.log('props.tabs',props.tabs)
  const emit = defineEmits(['refresh-table','get-response','select-treenode','update-treenode-title','select-file'])
  const refresh = (from_parent,table) => {
    // console.log('childComponentRefs',childComponentRefs)
    if(!from_parent){
      emit('refresh-table')
      return
    }
    if(table){
      // Проверяем существование компонента и метода refresh
      if(childComponentRefs.value[table] && typeof childComponentRefs.value[table].refresh === 'function'){
        childComponentRefs.value[table].refresh(true,table);
      }
      for(let key in props.tabs){
        if(childComponentRefs.value[key] && typeof childComponentRefs.value[key].refresh === 'function'){
          childComponentRefs.value[key].refresh(true,table);
        }
      }
    }else{
      for(let key in props.tabs){
        if(childComponentRefs.value[key] && typeof childComponentRefs.value[key].refresh === 'function'){
          childComponentRefs.value[key].refresh(true);
        }
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
  const selectFile = (event) => {
    emit('select-file', event)
  }
  const updateTreeNodeTitle = (event) => {
    emit('update-treenode-title', event)
  }
</script>
