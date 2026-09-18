<template>
    <!-- Кнопка в строке — того же вида, что и соседние действия (акцент темы):
         ряд из четырёх кнопок не должен распадаться на «цветные» и «белые». -->
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

    // В конфигах таблиц у действия лежит класс КНОПКИ (p-button-info,
    // p-button-rounded, p-button-success…). В меню он не к месту: пункт
    // превращался в цветную пилюлю со своим радиусом и заливкой, пилюли
    // налезали друг на друга, а пункты без класса рядом оставались обычными
    // строками. Поэтому классы кнопок сюда не пускаем — из них берём только
    // смысл: «удаление» помечаем, остальное рисуем одинаково.
    const isDanger = (cls) => typeof cls === 'string' && cls.indexOf('danger') > -1;

    for(let action in props.actions) {
        speedDialActions.value.push({
            label: props.actions[action].label?props.actions[action].label:'Удалить',
            icon: props.actions[action].icon?props.actions[action].icon:'pi pi-trash',
            class: 'pv-menu-item' + (isDanger(props.actions[action].class) ? ' pv-menu-item--danger' : ''),
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

    /* Пункт меню действий: строка с иконкой, а не кнопка. Все размеры и
       цвета — из токенов, поэтому меню следует за темой вместе со всем
       остальным. */
    .p-tieredmenu .pv-menu-item > .p-tieredmenu-item-link,
    .p-menu .pv-menu-item > .p-menu-item-link {
        gap: var(--gts-gap);
        padding: 6px 10px;
        border-radius: var(--gts-radius-s);
        color: var(--gts-ink);
    }
    .p-tieredmenu .pv-menu-item > .p-tieredmenu-item-link .p-menuitem-icon,
    .p-menu .pv-menu-item > .p-menu-item-link .p-menuitem-icon {
        color: var(--gts-ink-3);
    }
    .p-tieredmenu .pv-menu-item:hover > .p-tieredmenu-item-link,
    .p-menu .pv-menu-item:hover > .p-menu-item-link {
        background: var(--gts-surface-3);
        color: var(--gts-ink);
    }

    /* Удаление — единственный пункт, который обязан отличаться. */
    .p-tieredmenu .pv-menu-item--danger > .p-tieredmenu-item-link,
    .p-menu .pv-menu-item--danger > .p-menu-item-link,
    .p-tieredmenu .pv-menu-item--danger > .p-tieredmenu-item-link .p-menuitem-icon,
    .p-menu .pv-menu-item--danger > .p-menu-item-link .p-menuitem-icon {
        color: var(--gts-danger);
    }
    .p-tieredmenu .pv-menu-item--danger:hover > .p-tieredmenu-item-link,
    .p-menu .pv-menu-item--danger:hover > .p-menu-item-link {
        background: var(--gts-danger-soft);
        color: var(--gts-danger-hover);
    }
</style>
