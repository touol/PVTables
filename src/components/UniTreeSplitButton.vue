<template>
    <SplitButton v-if="checkAction" :model="speedDialActions" class="split-button"/>
</template>
<script setup>
    import SplitButton from 'primevue/splitbutton';
    import { ref, watchEffect } from 'vue';

    const props = defineProps({
        node: {
            type: Object,
            required: true,
        },
        actions: {
            type: Object,
            required: true,
        }
    });
    const speedDialActions = ref([])
    const checkAction = ref(false)
    const emit = defineEmits(['select-treenode-action']);
    watchEffect(() => {
        let node = props.node
        speedDialActions.value = []
        for(let action in props.actions) {
            if(props.actions[action].tables){
                for(let table in props.actions[action].tables){
                    let tmp = {
                        label: props.actions[action].tables[table].label, 
                        icon: props.actions[action].tables[table].icon, 
                        class: props.actions[action].tables[table].cls,
                    }
                    let parent_classes = String(props.actions[action].tables[table].parent_classes).split(',')
                    // console.log('parent_classes',parent_classes)
                    if(parent_classes.includes(props.node.data.class)){
                        speedDialActions.value.push({
                            label: tmp.label,
                            icon: tmp.icon,
                            class: 'flex flex-col items-center justify-between gap-2 p-2 border ' + tmp.class,
                            command: () => {
                                emit('select-treenode-action',{action,table,node})
                            }
                        });
                    }
                }
            }else{
                switch(action){
                    case 'delete':
                        if(props.node.data.class != 'root'){
                            let cls = props.actions[action].cls?props.actions[action].cls:'p-button-rounded p-button-info'
                            let table = null
                            speedDialActions.value.push({
                                label: props.actions[action].label?props.actions[action].label:'Удалить',
                                icon: props.actions[action].icon?props.actions[action].icon:'pi pi-trash',
                                class: 'flex flex-col items-center justify-between gap-2 p-2 border ' + cls,
                                command: () => {
                                    emit('select-treenode-action',{action,table,node})
                                }
                            })
                        }
                    break
                }
            }
            
        }
        if(speedDialActions.value.length > 0) checkAction.value = true
    })
    
    // import { Button } from 'pvtables/dist/pvtables'
    // const nodes = defineModel();
    // const emit = defineEmits(['insert-node', 'insert-node-modal']);
    // const insertNode = (node) => {
    //   emit('insert-node',{node})
    // }
    // const insertNodeModal = (node) => {
    //   emit('insert-node-modal',{node})
    // }
</script>
<style>
    .split-button .p-splitbutton-button{
        display: none;
    }
    .split-button .p-splitbutton-dropdown {
        border-top-left-radius: inherit;
        border-bottom-left-radius: inherit;
    }
</style>