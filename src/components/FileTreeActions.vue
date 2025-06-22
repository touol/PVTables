<template>
    <SplitButton v-if="actions.length > 0" :model="actions" class="file-tree-actions"/>
</template>

<script setup>
    import SplitButton from 'primevue/splitbutton';
    import { ref, watchEffect } from 'vue';

    const props = defineProps({
        node: {
            type: Object,
            required: true,
        }
    });

    const emit = defineEmits(['action']);
    const actions = ref([]);

    watchEffect(() => {
        const node = props.node;
        actions.value = [];

        if (node.data.is_dir) {
            // Действия для директорий
            actions.value = [
                {
                    label: 'Обновить',
                    icon: 'pi pi-refresh',
                    class: 'p-button-text',
                    command: () => {
                        emit('action', { type: 'refresh', node });
                    }
                },
                {
                    label: 'Переименовать',
                    icon: 'pi pi-pencil',
                    class: 'p-button-text',
                    command: () => {
                        emit('action', { type: 'rename', node });
                    }
                },
                {
                    label: 'Удалить',
                    icon: 'pi pi-trash',
                    class: 'p-button-text p-button-danger',
                    command: () => {
                        emit('action', { type: 'delete', node });
                    }
                },
                {
                    label: 'Создать файл',
                    icon: 'pi pi-file',
                    class: 'p-button-text',
                    command: () => {
                        emit('action', { type: 'create-file', node });
                    }
                },
                {
                    label: 'Создать директорию',
                    icon: 'pi pi-folder',
                    class: 'p-button-text',
                    command: () => {
                        emit('action', { type: 'create-directory', node });
                    }
                },
                {
                    label: 'Загрузить файлы',
                    icon: 'pi pi-upload',
                    class: 'p-button-text',
                    command: () => {
                        emit('action', { type: 'upload', node });
                    }
                },
                {
                    label: 'Копировать путь',
                    icon: 'pi pi-copy',
                    class: 'p-button-text',
                    command: () => {
                        emit('action', { type: 'copy-path', node });
                    }
                }
            ];
        } else {
            // Действия для файлов
            actions.value = [
                {
                    label: 'Скачать',
                    icon: 'pi pi-download',
                    class: 'p-button-text',
                    command: () => {
                        emit('action', { type: 'download', node });
                    }
                },
                {
                    label: 'Переименовать',
                    icon: 'pi pi-pencil',
                    class: 'p-button-text',
                    command: () => {
                        emit('action', { type: 'rename', node });
                    }
                },
                {
                    label: 'Удалить',
                    icon: 'pi pi-trash',
                    class: 'p-button-text p-button-danger',
                    command: () => {
                        emit('action', { type: 'delete', node });
                    }
                },
                {
                    label: 'Копировать путь',
                    icon: 'pi pi-copy',
                    class: 'p-button-text',
                    command: () => {
                        emit('action', { type: 'copy-path', node });
                    }
                }
            ];
        }
    });
</script>

<style>
    .file-tree-actions .p-splitbutton-button {
        display: none;
    }
    .file-tree-actions .p-splitbutton-dropdown {
        border-top-left-radius: inherit;
        border-bottom-left-radius: inherit;
    }
</style>
