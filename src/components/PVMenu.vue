<template>
    <span v-if="loading">Загрузка</span>

    <!-- ── Мобильный вид: кнопка + Drawer ─────────────────────────────── -->
    <template v-else-if="useMobileView">
        <Button
            icon="pi pi-bars"
            class="pv-menu-mobile-btn"
            text
            severity="secondary"
            @click="drawerVisible = true"
            aria-label="Меню"
        />
        <Drawer v-model:visible="drawerVisible" position="left" style="width:280px">
            <template #header>
                <span class="font-semibold text-base">Меню</span>
            </template>
            <PanelMenu :model="menuItems" class="pv-menu-panel">
                <template #item="{ item }">
                    <a
                        class="pv-menu-panel-item"
                        :href="item.url || '#'"
                        @click.prevent="item.url ? navigate(item.url) : undefined"
                    >
                        <span v-if="item.iconSvg" class="menu-icon" v-html="item.iconSvg" />
                        <i v-else-if="item.icon && item.icon !== 'custom-icon'" :class="item.icon" />
                        <span>{{ item.label }}</span>
                    </a>
                </template>
            </PanelMenu>
        </Drawer>
    </template>

    <!-- ── Десктоп: горизонтальный Menubar ────────────────────────────── -->
    <Menubar v-else :model="menuItems" class="pv-menu">
        <template #item="{ item, props, hasSubmenu }">
            <a class="flex align-items-center" v-bind="props.action" :href="item.url">
                <span v-if="item.iconSvg" class="menu-icon" v-html="item.iconSvg"></span>
                <i v-else-if="item.icon" :class="item.icon"></i>
                <span class="ml-2">{{ item.label }}</span>
                <i v-if="hasSubmenu" class="pi pi-angle-down ml-auto"></i>
            </a>
        </template>
    </Menubar>
</template>

<script setup>
import Menubar   from 'primevue/menubar';
import PanelMenu from 'primevue/panelmenu';
import Drawer    from 'primevue/drawer';
import Button    from 'primevue/button';
import { ref, onMounted } from 'vue';
import apiCtor from './api';
import { useNotifications } from "./useNotifications";
import { useMobileLayout } from '../composables/useMobileLayout';

const props = defineProps({
    table: {
        type: String,
        required: true,
    }
});

const loading = ref(true);
const api = apiCtor(props.table);
const { notify } = useNotifications();
const { useMobileView } = useMobileLayout();
const drawerVisible = ref(false);

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

const navigate = (url) => {
    drawerVisible.value = false;
    if (url.startsWith('http://') || url.startsWith('https://')) {
        window.open(url, '_blank');
    } else {
        window.location.href = url;
    }
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

/* Десктоп Menubar */
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

/* Мобильная кнопка */
.pv-menu-mobile-btn {
    font-size: 1.25rem;
}

/* PanelMenu в Drawer */
.pv-menu-panel {
    width: 100%;
}

.pv-menu-panel-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    text-decoration: none;
    color: inherit;
    border-radius: 6px;
    transition: background 0.15s;
    width: 100%;
}

.pv-menu-panel-item:hover {
    background: var(--p-surface-100, #f3f4f6);
}
</style>
