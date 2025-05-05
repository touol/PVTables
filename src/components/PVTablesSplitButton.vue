<template>
    <SplitButton :model="speedDialActions" class="split-button"/>
</template>
<script setup>
    import SplitButton from 'primevue/splitbutton';
    import { ref } from 'vue';

    const props = defineProps({
        actions: {
            type: Object,
            required: true,
        }
    });
    const speedDialActions = ref([])
    const emit = defineEmits(['pvtables-menu-action']);
    for(let action in props.actions) {
        speedDialActions.value.push({
            label: props.actions[action].label?props.actions[action].label:'Удалить',
            icon: props.actions[action].icon?props.actions[action].icon:'pi pi-trash',
            class: 'flex flex-col items-center justify-between gap-2 p-2 border ' + props.actions[action].class,
            command: () => {
                emit('pvtables-menu-action',{action})
            }
        })
    }
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