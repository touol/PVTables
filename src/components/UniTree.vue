<template>
    <span v-if="loading">Загрузка</span>
    <div v-else class="uni-tree">
        <Button
            label="Обновить"
            class="p-button-text"
            @click="loadTree"
            />
        <sl-vue-tree-next 
            v-model="nodes" 
            ref="slVueTree" 
            @toggle="toggleNode"
            @nodeclick="onNodeclick"
            @drop="onDrop"
            >
            <template #sidebar="{ node }">
                <UniTreeSplitButton 
                :node="node"
                :actions="actions" 
                @select-treenode-action="selectTreeNodeAction($event)"
                />
            </template>
        </sl-vue-tree-next>
    </div>
    <Dialog
      v-model:visible="ItemDialog"
      :header="ItemDialogLabel"
      modal
      >
      
      <PVForm 
        v-model="Item" 
        :columns="columns" 
        :mywatch="mywatch"
      />
      <template #footer>
        <Button
          label="Отмена"
          icon="pi pi-times"
          class="p-button-text"
          @click="ItemDialog = false"
          />
        <Button
          label="Сохранить"
          icon="pi pi-check"
          class="p-button-text"
          @click="saveItem"
          />
      </template>
    </Dialog>
    <Dialog
        v-model:visible="deleteDialog"
        header="Подтвердите"
        modal
        >
        <div class="confirmation-content">
            <i class="pi pi-exclamation-triangle p-mr-3" style="font-size: 2rem" />
            <span>Вы действительно хотите удалить запись?</span>
        </div>

        <template #footer>
            <Button
            label="Нет"
            icon="pi pi-times"
            class="p-button-text"
            @click="deleteDialog = false"
            />
            <Button
            label="Да"
            icon="pi pi-check"
            class="p-button-text"
            @click="deleteItem"
            />
        </template>
    </Dialog>
    <Toast/>
</template>
<script setup>
    import Toast from 'primevue/toast';
    import Dialog from "primevue/dialog";
    import Button from "primevue/button";
    import UniTreeSplitButton from './UniTreeSplitButton.vue'
    import { SlVueTreeNext } from 'sl-vue-tree-next'
    import { ref, onMounted } from 'vue';
    import apiCtor from './api'
    import { useNotifications } from "./useNotifications";
    import PVForm from "./PVForm.vue";

    const props = defineProps({
        table: {
            type: String,
            required: true,
        }
    });
    const loading = ref(true);
    const api = apiCtor(props.table)
    const { notify } = useNotifications();

    const nodes = ref([]);
    let expanded = {}
    const slVueTree = ref();
    const actions = ref({});
    const nodeclick = ref({});
    // const useUniTree = ref(false)
    const current_id = ref(0)

    let params = new URLSearchParams(document.location.search);
    onMounted(async () => {
        
        if(params.get(props.table + "/id") > 0) current_id.value = params.get(props.table + "/id")
        await loadTree()
    })
    let fields = {}
    const loadTree = async () => { /* logic to load tree data */ 
        try {
            const response = await api.options()
            // console.log('response.data',response.data)
            nodes.value = response.data.out.slTree;
            actions.value = response.data.actions;
            // useUniTree.value = response.data.useUniTree
            nodeclick.value = response.data.nodeclick
            //set fields
            fields = response.data.fields;
            
            setTimeout(() => {
                if(current_id.value > 0){
                    slVueTree.value.traverse((node, nodeModel, path) => {
                        if(node.data.id == current_id.value){
                            expanded[node.pathStr] = node.path
                            onNodeclick(node)
                            return false
                        }
                    })
                }
                expandTree()
            }, 0);
            loading.value = false;
            
        } catch (error) {
            notify('error', { detail: error.message }, true);
        }

    }
    const expandTree = async () => {
        for(let pathStr in expanded){
            for(let n in expanded[pathStr]){
                slVueTree.value.updateNode({ path: expanded[pathStr].slice(0, n), patch: { isExpanded: true } })
            }
        }
    }
    const toggleNode = (toggledNode, event) => {
        // console.log('toggledNode',toggledNode)
        if(toggledNode.isExpanded){
            delete expanded[toggledNode.pathStr]
        }else{
            expanded[toggledNode.pathStr] = toggledNode.path
        }
    }
    const emit = defineEmits(['select-treenode']);

    //onDrop
    const onDrop = async (nodes, position, event) => {
        console.log(`Nodes: ${nodes
            .map((node) => node.title)
            .join(', ')} are dropped ${position.placement} ${position.node.title}`)
        console.log('position',position)

        let class_key = ''
        let nodes1 = []
        for(let k in nodes){
            if(class_key == '') class_key = nodes[k].data.class
            if(class_key != nodes[k].data.class){
                notify('error', { detail: 'Cannot move nodes of different classes' }, true);
                return
            }
            nodes1.push({id:nodes[k].data.id,parent_id:nodes[k].data.parent_id,menuindex:nodes[k].data.menuindex})
        }
        const position1 = {
            placement:position.placement,
            node:{id:position.node.data.id,parent_id:position.node.data.parent_id,menuindex:position.node.data.menuindex}
        }
        try {
            const response = await api.nodedrop({nodes1,position1})
        } catch (error) {
            notify('error', { detail: error.message }, true);
        }

    }
    const onNodeclick = async (node) => {
        // console.log('nodeclick.value.classes',nodeclick.value.classes)
        if(nodeclick.value.classes){
            let tabs
            if(nodeclick.value.classes[node.data.class]){
                if(nodeclick.value.classes[node.data.class].tabs){
                    tabs = nodeclick.value.classes[node.data.class].tabs
                }else if(nodeclick.value.classes[node.data.class].table){
                    const apiTable = apiCtor(nodeclick.value.classes[node.data.class].table)
                    try {
                        const data = await apiTable.get(node.data.target_id)
                        for(let key in nodeclick.value.classes[node.data.class]){
                            if(key == 'table') continue
                            if(nodeclick.value.classes[node.data.class][key].if){
                                let check = true
                                for(let k in nodeclick.value.classes[node.data.class][key].if){
                                    if(data[k] != nodeclick.value.classes[node.data.class][key].if[k]) check = false
                                }
                                if(check) tabs = nodeclick.value.classes[node.data.class][key].tabs
                            }
                        }
                    } catch (error) {
                        notify('error', { detail: error.message }, true);
                    }
                }
            }else if(nodeclick.value.classes.default){
                // console.log('nodeclick.value.classes.default',nodeclick.value.classes.default)
                if(nodeclick.value.classes.default.tabs){
                    tabs = nodeclick.value.classes['default'].tabs
                }else if(nodeclick.value.classes['default'].table){
                    const apiTable = apiCtor(nodeclick.value.classes['default'].table)
                    try {
                        const data = await apiTable.get(node.data.target_id)
                        for(let key in nodeclick.value.classes['default']){
                            if(key == 'table') continue
                            if(nodeclick.value.classes['default'][key].if){
                                let check = true
                                for(let k in nodeclick.value.classes['default'][key].if){
                                    if(data[k] != nodeclick.value.classes['default'][key].if[k]) check = false
                                }
                                if(check) tabs = nodeclick.value.classes['default'][key].tabs
                            }
                        }
                    } catch (error) {
                        notify('error', { detail: error.message }, true);
                    }
                }
            }
            // console.log('tabs',tabs)

            if(node.data.id > 0){
                current_id.value = node.data.id
                params.set(props.table + "/id",current_id.value)
                window.history.replaceState({}, '', `${location.pathname}?${params}`);
            }
            let subfilters = {}
            for(let key in tabs){
                if (tabs[key].hasOwnProperty("where")) {
                    let tmpfilters = {};
                    for (let field in tabs[key].where) {
                        let value = tabs[key].where[field]
                        if(value == 'current_id') value = node.data.target_id 
                        tmpfilters[field] = {
                            operator: 'and',
                            constraints: [
                                {
                                value: value,
                                matchMode: 'equals',
                                },
                            ],
                        };
                    }
                    subfilters[key] = tmpfilters;
                }
            }
            emit('select-treenode',{tabs,node,subfilters})
        }
        
    }
    const setCollomns = (fields) => {
        let cols = [];
        for (let field in fields) {
          fields[field].field = field;
          if (!fields[field].hasOwnProperty("label")) {
            fields[field].label = field;
          }
          if (!fields[field].hasOwnProperty("type")) fields[field].type = "text";
          if (fields[field].hasOwnProperty("readonly")){
            if(fields[field].readonly === true || fields[field].readonly == 1){
              fields[field].readonly = true
            }else{
              fields[field].readonly = false
            }
          }
          cols.push(fields[field]);
        }
        return cols
    }
    const Item = ref({})
    const columns = ref({})
    
    const selectTreeNodeAction = (event) => {
        // console.log('event',event)
        if(actions.value[event.action].tables){
            const action = actions.value[event.action].tables[event.table]
            if(action.form == 'UniTree'){
                let fields0 = {
                    title:{
                        type: "text",
                        label: "Заголовок"
                    }
                }
                if(action.add_fields && Object.keys(action.add_fields).length > 0) {
                    fields0 = {...fields0, ...action.add_fields}
                }
                columns.value = setCollomns(fields0)
                Item.value = {
                    parent_id: event.node.data.id,
                    form: 'UniTree',
                    table: event.table
                };
                if(action.label) ItemDialogLabel.value = action.label
                ItemDialog.value = true;
            }
        }else{
            switch(event.action){
                case 'delete':
                    Item.value = {
                        ids: event.node.data.id
                    };
                    deleteDialog.value = true;
                break
            }
        }
        
    }
    const ItemDialog = ref(false)
    const deleteDialog = ref(false)
    
    const saveItem = async () => {
        try {
            if(Item.value.form == 'UniTree'){
                const response = await api.create(Item.value,{})
                if (!response.success) {
                    notify('error', { detail: response.message }, true);
                }
                Item.value = {};
                ItemDialog.value = false;
                loadTree()
            }
        } catch (error) {
            notify('error', { detail: error.message });
        }
    };
    const deleteItem = async () => {
        try {
            const response = await api.delete(Item.value)
            if (!response.success) {
                notify('error', { detail: response.message }, true);
            }
            Item.value = {};
            deleteDialog.value = false;
            loadTree()
        } catch (error) {
            notify('error', { detail: error.message });
        }
    };
    
    const ItemDialogLabel = ref('Создать')
    const mywatch = ref({
        enabled: false,
        fields: [],
        table: '',
        action: ''
    });
    
    
    const refresh = (from_parent,table) => {
        loadTree()
    };
    defineExpose({ refresh });
</script>
<style>
    @import 'sl-vue-tree-next/sl-vue-tree-next-minimal.css';
    .sl-vue-tree-next-root{
      font-size: x-large;
    }
    .uni-tree{
        height: 100%; 
        width: 100%; 
        overflow: auto;
    }
</style>