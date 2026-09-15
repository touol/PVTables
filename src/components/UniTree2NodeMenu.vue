<template>
    <span v-if="checkAction" class="ut2-node-menu">
        <Button
            type="button"
            class="ut2-node-menu__btn"
            icon="pi pi-ellipsis-v"
            text
            severity="secondary"
            rounded
            :aria-label="'Действия'"
            @click.stop="toggle"
        />
        <Menu ref="menuRef" :model="nodeActions" :popup="true" class="ut2-node-menu__list" @hide="onMenuHide" />
    </span>
</template>
<script>
// Одно открытое меню на всё дерево. Клик по кнопке узла идёт с .stop — иначе
// он выбрал бы узел, — поэтому документ не закрывает ранее открытое меню сам,
// и выпадашки копятся одна на другой. Переменная лежит в области МОДУЛЯ:
// внутри <script setup> она была бы своей у каждого экземпляра.
let openMenu = null
export default { name: 'UniTree2NodeMenu' }
</script>
<script setup>
    // Компактная замена UniTreeSplitButton для UniTree2.
    // Отличия: одна иконка «⋮» вместо синего SplitButton у каждого узла,
    // всплывающее Menu вместо выпадашки — на узкий экран и на палец.
    // Набор пунктов формируется по той же схеме, что и в UniTreeSplitButton.
    import Button from 'primevue/button';
    import Menu from 'primevue/menu';
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
    const menuRef = ref()
    const nodeActions = ref([])
    const checkAction = ref(false)
    const emit = defineEmits(['select-treenode-action']);

    const toggle = (event) => {
        const isSame = openMenu === menuRef.value
        if (openMenu && !isSame) openMenu.hide()
        menuRef.value.toggle(event)
        openMenu = isSame ? null : menuRef.value
    }

    const onMenuHide = () => {
        if (openMenu === menuRef.value) openMenu = null
    }

    watchEffect(() => {
        let node = props.node
        nodeActions.value = []
        for(let action in props.actions) {
            if(props.actions[action].tables){
                for(let table in props.actions[action].tables){
                    const cfg = props.actions[action].tables[table]
                    let parent_classes = String(cfg.parent_classes).split(',')
                    if(parent_classes.includes(props.node.data.class)){
                        nodeActions.value.push({
                            // cfg.cls из конфига — это классы КНОПКИ
                            // (p-button-rounded p-button-info). На пункте меню они
                            // дают заливку кнопки при цвете текста меню — надпись
                            // сливается с фоном. Пункты меню оформляем единообразно.
                            label: cfg.label,
                            icon: cfg.icon,
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
                            nodeActions.value.push({
                                label: props.actions[action].label ? props.actions[action].label : 'Удалить',
                                icon: props.actions[action].icon ? props.actions[action].icon : 'pi pi-trash',
                                class: 'ut2-node-menu__danger',
                                command: () => {
                                    emit('select-treenode-action',{action,table:null,node})
                                }
                            })
                        }
                    break
                }
            }
        }
        checkAction.value = nodeActions.value.length > 0
    })
</script>
<style>
    .ut2-node-menu__btn.p-button {
        width: 1.85rem;
        height: 1.85rem;
        padding: 0;
    }
    .ut2-node-menu__btn .p-button-icon {
        font-size: 0.8rem;
    }
    /* На палец кнопка должна быть крупнее — правило дублируется в UniTree2. */
    .ut2--touch .ut2-node-menu__btn.p-button {
        width: 2.4rem;
        height: 2.4rem;
    }
    .ut2--touch .ut2-node-menu__btn .p-button-icon {
        font-size: 1rem;
    }
    .ut2-node-menu__list .ut2-node-menu__danger .p-menu-item-link {
        color: var(--p-red-500, #ef4444);
    }
</style>
