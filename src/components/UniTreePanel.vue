<template>
    <div class="tree-outer-container">
        <Splitter>
            <SplitterPanel class="flex" :size="size">
                <div class="tree-container">
                    <PVTabs 
                        :tabs="treetabs"
                        :actions="{}"
                        :filters="{}"
                        @select-treenode="selectTreenode"
                        @select-file="selectFile"
                        ref="childComponentRefTree"
                    />
                </div>
            </SplitterPanel>
            <SplitterPanel class="flex" :size="100 - size">
                <div class="gap-1" style="width:100%;">
                    <h1>{{ title }} {{ current_id }}</h1>
                    <div class="tree-panel-container">
                        <PVTabs 
                            :tabs="paneltabs"
                            :actions="{}"
                            :filters="filters"
                            :current_id="current_id"
                            :class_key="class_key"
                            @update-treenode-title="updateTreeNodeTitle"
                            ref="childComponentRefPanel"
                        />
                    </div>
                </div>
            </SplitterPanel>
        </Splitter>
    </div>
    <Toast/>
</template>
<script setup>
    import Toast from 'primevue/toast';
    import Splitter from 'primevue/splitter';
    import SplitterPanel from 'primevue/splitterpanel';
    import { ref, onMounted } from 'vue';
    import PVTabs from './PVTabs.vue'
    const childComponentRefTree = ref()
    const childComponentRefPanel = ref()
    const props = defineProps({
        treetabs: {
            type: Object,
            required: true,
        },
        mediaSources: {
            type: Array,
            default: () => [],
        }
    });
    const size = ref(20);
    
    const paneltabs = ref({})
    const current_id = ref('')
    const class_key = ref('')
    const title = ref('')
    const filters = ref({});
    const selectTreenode = (event) => {
        // console.log('event.tabs',event.tabs)
        paneltabs.value = event.tabs
        current_id.value = event.node.data.target_id ? event.node.data.target_id : event.node.data.id
        class_key.value = event.node.data.class
        title.value = ''
        if(event.label) title.value = event.label + ': '
        title.value += event.node.title
        filters.value = event.subfilters
        // console.log('event',event)
        // console.log('paneltabs.value',paneltabs.value)
    }
    const updateTreeNodeTitle = (event) => {
        childComponentRefTree.value.refresh(true,event.uniTreeTable)
    }
    
    // Обработчик события select-file от FileTree
    const selectFile = (event) => {
        // Создаем вкладку для отображения содержимого файла
        paneltabs.value = {
            content: {
                type: 'filecontent',
                title: 'Содержимое',
                file: event.file,
                content: event.content,
                mime: event.mime,
                mediaSource: event.mediaSource
            }
        }
        
        title.value = event.file.path
        current_id.value = 0
        filters.value = {}
    }
</script>
<style>
    .sl-vue-tree-next-root{
      font-size: x-large;
    }
    .tree-outer-container{
      height: 80vh;
      width: 100%;
      overflow: auto;
      
    }
    /* .tree-container{
        position: fixed;
      top:0;
      
    } */
    .tree-container .p-tabpanels{
      height: 95vh;
      width: 100%;
      overflow: auto;
      
    }
    .tree-container, .tree-container .p-splitter, .tree-container .p-splitterpanel,
    .tree-container .p-tabs, .tree-container .p-tabpanel
    {
      height: 100%;
      width: 100%;
    }
    /* .tree-panel-container{
        height: 100%; 
        width: 100%; 
        overflow: auto;
    } */
    .tree-outer-container .p-tablist-tab-list
    {
        display: inherit !important;
    }
</style>
