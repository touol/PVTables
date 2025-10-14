<template>
    <span v-if="loading">Загрузка</span>
    <Menubar v-else :model="menuItems" class="pv-menu">
        <template #item="{ item, props, hasSubmenu }">
            <a class="flex align-items-center" v-bind="props.action">
                <span v-if="item.iconSvg" class="menu-icon" v-html="item.iconSvg"></span>
                <i v-else-if="item.icon" :class="item.icon"></i>
                <span class="ml-2">{{ item.label }}</span>
                <i v-if="hasSubmenu" class="pi pi-angle-down ml-auto"></i>
            </a>
        </template>
    </Menubar>
</template>

<script setup>
import Menubar from 'primevue/menubar';
import { ref, onMounted } from 'vue';
import apiCtor from './api';
import { useNotifications } from "./useNotifications";

const props = defineProps({
    table: {
        type: String,
        required: true,
    }
});

const loading = ref(true);
const api = apiCtor(props.table);
const { notify } = useNotifications();

const menuItems = ref([]);
const gtsAPIUniTreeClass = ref({});

onMounted(async () => {
    await loadMenu();
});

const loadMenu = async () => {
    try {
        const response = await api.options();
        const slTreeData = response.data.out.slTree;
        gtsAPIUniTreeClass.value = response.data.gtsAPIUniTreeClass || {};
        
        // Преобразуем данные slTree в формат PanelMenu
        menuItems.value = convertSlTreeToPanelMenu(slTreeData);
        
        loading.value = false;
    } catch (error) {
        notify('error', { detail: error.message }, true);
        loading.value = false;
    }
};

const convertSlTreeToPanelMenu = (nodes) => {
    if (!nodes || !Array.isArray(nodes)) return [];
    
    return nodes
        .filter(node => node.data && node.data.active !== 0) // Фильтруем неактивные элементы
        .map(node => {
            const menuItem = {
                label: node.title || 'Без названия',
                key: node.data.id
            };
            
            // Добавляем иконку если есть
            if (node.data.class && gtsAPIUniTreeClass.value[node.data.class] && gtsAPIUniTreeClass.value[node.data.class].svg) {
                // Для PanelMenu используем CSS класс или прямую вставку SVG
                menuItem.icon = 'custom-icon';
                menuItem.iconSvg = gtsAPIUniTreeClass.value[node.data.class].svg;
            }
            
            // Добавляем URL и команду только если нет дочерних элементов
            if (node.data.url && (!node.children || node.children.length === 0)) {
                menuItem.url = node.data.url;
                // Добавляем команду для обработки клика только для элементов без детей
                menuItem.command = () => {
                    handleMenuClick(node);
                };
            }
            
            // Рекурсивно обрабатываем дочерние элементы
            if (node.children && node.children.length > 0) {
                menuItem.items = convertSlTreeToPanelMenu(node.children);
            }
            
            return menuItem;
        });
};

const handleMenuClick = (node) => {
    // Если есть URL, переходим по нему
    if (node.data.url) {
        // Проверяем, является ли URL внешней ссылкой
        if (node.data.url.startsWith('http://') || node.data.url.startsWith('https://')) {
            window.open(node.data.url, '_blank');
        } else {
            // Внутренняя ссылка
            window.location.href = node.data.url;
        }
    }
    
    // Эмитим событие для родительского компонента
    emit('menu-click', {
        node: node,
        url: node.data.url
    });
};

const emit = defineEmits(['menu-click']);

// Метод для обновления меню (может быть вызван извне)
const refresh = () => {
    loadMenu();
};

defineExpose({ refresh });
</script>

<style scoped>
.pv-menu {
    width: 100%;
}

.menu-icon {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
}

.menu-icon :deep(svg) {
    width: 16px;
    height: 16px;
}

/* Стили для горизонтального меню */
.pv-menu :deep(.p-menubar) {
    border-radius: 6px;
}

.pv-menu :deep(.p-menubar-root-list) {
    display: flex;
    align-items: center;
    gap: 0;
}

.pv-menu :deep(.p-menuitem-link) {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    text-decoration: none;
    border-radius: 6px;
    transition: background-color 0.2s;
}

.pv-menu :deep(.p-menuitem-link:hover) {
    background-color: var(--primary-color);
    color: var(--primary-color-text);
}

.pv-menu :deep(.p-submenu-list) {
    min-width: 200px;
}
</style>
