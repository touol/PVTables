<template>
    <span v-if="loading">Загрузка</span>
    <div v-else class="file-tree">
        <div class="tree-controls">
            <Button
            icon="pi pi-refresh"
            class="p-button-text"
            @click="loadTree('/')"
            />
            <ToggleButton
                v-model="showHidden"
                onIcon="pi pi-eye"
                offIcon="pi pi-eye-slash"
                class="p-button-sm"
                @change="applyFilters"
            />
        </div>
        <sl-vue-tree-next 
            v-model="filteredNodes" 
            ref="slVueTree" 
            @toggle="toggleNode"
            @nodeclick="onNodeclick"
            >
            <template #sidebar="{ node }">
                <FileTreeActions 
                    :node="node"
                    @action="handleAction"
                />
            </template>
            <template #title="{ node }">
                <span class="node-icon">
                    <i v-if="node.data.is_dir" class="pi pi-folder"></i>
                    <i v-else :class="getFileIcon(node.data)"></i>
                </span>
                <span v-html="highlightText(node)"></span>
            </template>
        </sl-vue-tree-next>
    </div>
    
    <!-- Диалог для переименования -->
    <Dialog 
        v-model:visible="renameDialog" 
        header="Переименовать" 
        :style="{ width: '450px' }" 
        modal
    >
        <div class="p-fluid">
            <div class="p-field">
                <label for="name">Новое имя</label>
                <InputText id="name" v-model="renameItem.newName" autofocus />
            </div>
        </div>
        <template #footer>
            <Button label="Отмена" icon="pi pi-times" class="p-button-text" @click="renameDialog = false" />
            <Button label="Сохранить" icon="pi pi-check" class="p-button-text" @click="confirmRename" />
        </template>
    </Dialog>
    
    <!-- Диалог для создания файла -->
    <Dialog 
        v-model:visible="createFileDialog" 
        header="Создать файл" 
        :style="{ width: '450px' }" 
        modal
    >
        <div class="p-fluid">
            <div class="p-field">
                <label for="fileName">Имя файла</label>
                <InputText id="fileName" v-model="createItem.name" autofocus />
            </div>
        </div>
        <template #footer>
            <Button label="Отмена" icon="pi pi-times" class="p-button-text" @click="createFileDialog = false" />
            <Button label="Создать" icon="pi pi-check" class="p-button-text" @click="confirmCreateFile" />
        </template>
    </Dialog>
    
    <!-- Диалог для создания директории -->
    <Dialog 
        v-model:visible="createDirDialog" 
        header="Создать директорию" 
        :style="{ width: '450px' }" 
        modal
    >
        <div class="p-fluid">
            <div class="p-field">
                <label for="dirName">Имя директории</label>
                <InputText id="dirName" v-model="createItem.name" autofocus />
            </div>
        </div>
        <template #footer>
            <Button label="Отмена" icon="pi pi-times" class="p-button-text" @click="createDirDialog = false" />
            <Button label="Создать" icon="pi pi-check" class="p-button-text" @click="confirmCreateDir" />
        </template>
    </Dialog>
    
    <!-- Диалог для удаления -->
    <Dialog 
        v-model:visible="deleteDialog" 
        header="Подтверждение удаления" 
        :style="{ width: '450px' }" 
        modal
    >
        <div class="confirmation-content">
            <i class="pi pi-exclamation-triangle mr-3" style="font-size: 2rem" />
            <span>Вы уверены, что хотите удалить "{{ deleteItem.name }}"?</span>
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" class="p-button-text" @click="deleteDialog = false" />
            <Button label="Да" icon="pi pi-check" class="p-button-text p-button-danger" @click="confirmDelete" />
        </template>
    </Dialog>
    
    <!-- Диалог для загрузки файлов -->
    <Dialog 
        v-model:visible="uploadDialog" 
        header="Загрузить файлы" 
        :style="{ width: '450px' }" 
        modal
    >
        <div class="p-fluid">
            <div class="p-field">
                <label for="file">Выберите файлы для загрузки</label>
                <input type="file" id="file" multiple @change="handleFileUpload" />
            </div>
        </div>
        <template #footer>
            <Button label="Отмена" icon="pi pi-times" class="p-button-text" @click="uploadDialog = false" />
            <Button label="Загрузить" icon="pi pi-upload" class="p-button-text" @click="confirmUpload" />
        </template>
    </Dialog>
    
    <Toast/>
</template>
<script setup>
    import Toast from 'primevue/toast';
    import Button from "primevue/button";
    import ToggleButton from "primevue/togglebutton";
    import Dialog from "primevue/dialog";
    import InputText from "primevue/inputtext";
    import FileTreeActions from "./FileTreeActions.vue";

    import { SlVueTreeNext } from 'sl-vue-tree-next'
    import { ref, onMounted, watch } from 'vue';
    import { useNotifications } from "./useNotifications";
    import FileService from '../services/FileService';

const props = defineProps({
        mediaSources: {
            type: Array,
            default: () => [],
        }
    });
    
    const loading = ref(true);
    const fileService = new FileService();
    const { notify } = useNotifications();

    const nodes = ref([]);
    let expanded = {}
    const slVueTree = ref();
    const showHidden = ref(false);
    const currentPath = ref('/');
    const mediaSources = ref([]);
    const currentSource = ref(null);

    onMounted(async () => {
        await loadMediaSources();
    });

    // Загрузка списка медиа-источников
    const loadMediaSources = async () => {
        try {
            loading.value = true;
            
            const response = await fileService.getMediaSources();
            
            if (response.success !== 1) {
                notify('error', { detail: response.message || 'Ошибка при загрузке медиа-источников' }, true);
                loading.value = false;
                return;
            }
            
            // Фильтруем источники, если указан список разрешенных
            if (props.mediaSources && props.mediaSources.length > 0) {
                mediaSources.value = response.sources.filter(source => 
                    props.mediaSources.includes(source.id)
                );
            } else {
                mediaSources.value = response.sources;
            }
            
            // Преобразуем источники в формат для дерева
            nodes.value = transformSourcesToTreeNodes(mediaSources.value);
            
            // Применяем фильтры
            applyFilters();
            
            loading.value = false;
        } catch (error) {
            notify('error', { detail: error.message }, true);
            loading.value = false;
        }
    }
    
    // Преобразование источников в формат для дерева
    const transformSourcesToTreeNodes = (sources) => {
        return sources.map(source => ({
            title: source.name,
            isLeaf: false,
            isExpanded: false,
            data: {
                id: `source-${source.id}`,
                sourceId: source.id,
                is_dir: true,
                hidden: false,
                type: 'source',
                path: '/'
            },
            children: []
        }));
    }

    const loadTree = async (path = '/', sourceId = null) => { 
        try {
            loading.value = true;
            
            // Если это корневой уровень и не указан sourceId, загружаем список источников
            if (path === '/' && !sourceId) {
                await loadMediaSources();
                loading.value = false;
                return;
            }
            
            currentPath.value = path;
            currentSource.value = sourceId;
            
            const response = await fileService.getFiles(path, sourceId);
            
            if (response.success !== 1) {
                notify('error', { detail: response.message || 'Ошибка при загрузке файлов' }, true);
                loading.value = false;
                return;
            }
            
            // Если это корневой уровень, добавляем файлы и директории к соответствующему источнику
            if (path === '/') {
                // Находим индекс источника в дереве
                const sourceIndex = nodes.value.findIndex(node => node.data.sourceId === sourceId);
                
                if (sourceIndex !== -1) {
                    // Преобразуем полученные данные в формат для SlVueTreeNext
                    const children = transformToTreeNodes(response.files, response.directories, path, sourceId);
                    
                    // Обновляем узел источника с новыми дочерними элементами
                    nodes.value[sourceIndex].children = children;
                    nodes.value[sourceIndex].isExpanded = true;
                }
            } else {
                // Для других уровней просто обновляем nodes.value
                nodes.value = transformToTreeNodes(response.files, response.directories, path, sourceId);
            }
            
            // Применяем фильтры
            applyFilters();
            
            // Раскрываем дерево
            setTimeout(() => {
                expandTree();
            }, 0);
            
            loading.value = false;
        } catch (error) {
            notify('error', { detail: error.message }, true);
            loading.value = false;
        }
    }
    
    // Функция для преобразования данных в формат для SlVueTreeNext
    const transformToTreeNodes = (files, directories, parentPath, sourceId = null) => {
        const nodes = [];
        
        // Добавляем директории
        directories.forEach(dir => {
            const isHidden = dir.name.startsWith('.');
            
            nodes.push({
                title: dir.name,
                isLeaf: false,
                isExpanded: false,
                data: {
                    id: dir.path,
                    path: dir.path,
                    is_dir: true,
                    hidden: isHidden,
                    type: 'directory',
                    size: dir.size,
                    lastmod: dir.lastmod,
                    sourceId: sourceId
                },
                children: []
            });
        });
        
        // Добавляем файлы
        files.forEach(file => {
            const isHidden = file.name.startsWith('.');
            const ext = file.name.split('.').pop().toLowerCase();
            
            nodes.push({
                title: file.name,
                isLeaf: true,
                data: {
                    id: file.path,
                    path: file.path,
                    is_dir: false,
                    hidden: isHidden,
                    type: file.type,
                    ext: ext,
                    size: file.size,
                    lastmod: file.lastmod,
                    editable: file.editable,
                    sourceId: sourceId
                }
            });
        });
        
        return nodes;
    }
    
    // Функция для загрузки дочерних элементов узла
    const loadNodeChildren = async (node) => {
        // Если это источник и у него нет дочерних элементов, загружаем их
        if (node.data.type === 'source' && (!node.children || node.children.length === 0)) {
            try {
                // Загружаем файлы и директории для источника
                const response = await fileService.getFiles('/', node.data.sourceId);
                
                if (response.success !== 1) {
                    notify('error', { detail: response.message || 'Ошибка при загрузке файлов' }, true);
                    return false;
                }
                
                // Преобразуем полученные данные в формат для SlVueTreeNext
                const children = transformToTreeNodes(response.files, response.directories, '/', node.data.sourceId);
                
                // Обновляем узел с новыми дочерними элементами
                slVueTree.value.updateNode({ 
                    path: node.path, 
                    patch: { 
                        children: children,
                        isExpanded: true
                    } 
                });
                
                return true;
            } catch (error) {
                console.log('error', error);
                notify('error', { detail: error.message }, true);
                return false;
            }
        }
        // Если это директория и у нее нет дочерних элементов, загружаем их
        else if (node.data.is_dir && (!node.children || node.children.length === 0)) {
            try {
                const response = await fileService.getFiles(node.data.path, node.data.sourceId);
                
                if (response.success !== 1) {
                    notify('error', { detail: response.message || 'Ошибка при загрузке файлов' }, true);
                    return false;
                }
                
                // Преобразуем полученные данные в формат для SlVueTreeNext
                const children = transformToTreeNodes(response.files, response.directories, node.data.path, node.data.sourceId);
                if(!children) return;
                // Обновляем узел с новыми дочерними элементами
                slVueTree.value.updateNode({ 
                    path: node.path, 
                    patch: { 
                        children: children,
                        isExpanded: true
                    } 
                });
                
                return true;
            } catch (error) {
                console.log('error', error);
                notify('error', { detail: error.message }, true);
                return false;
            }
        }
        
        return true; // Если узел уже имеет дочерние элементы или не является директорией/источником
    };
    
    const expandTree = async () => {
        if(!slVueTree.value) return;

        for(let pathStr in expanded){
            
            // Получаем узел по пути
            for(let n in expanded[pathStr]){
                const nodePath = expanded[pathStr].slice(0, parseInt(n) + 1);
                const node = slVueTree.value.getNode(nodePath);
                
                if (node) {
                    // Загружаем дочерние элементы, если их нет
                    if (!node.children || node.children.length === 0) {
                        await loadNodeChildren(node);
                    }
                    
                    // Раскрываем узел
                    slVueTree.value.updateNode({ 
                        path: nodePath, 
                        patch: { isExpanded: true } 
                    });
                }
            }
        }
    }
    
    const toggleNode = async (toggledNode, event) => {
        if(toggledNode.isExpanded){
            delete expanded[toggledNode.pathStr]
        } else {
            expanded[toggledNode.pathStr] = toggledNode.path
            
            // Загружаем дочерние элементы, если их нет
            await loadNodeChildren(toggledNode);
        }
    }
    
    const emit = defineEmits(['select-file']);

    const onNodeclick = async (node) => {
        if (node.data.is_dir) {
            // Если это директория или источник, раскрываем/сворачиваем её
            // slVueTree.value.updateNode({ 
            //     path: node.path, 
            //     patch: { isExpanded: !node.isExpanded } 
            // });
            
            if (!node.isExpanded && (!node.children || node.children.length === 0)) {
                await toggleNode(node);
            }
        } else {
            // Если это файл, отправляем событие для отображения содержимого
            
            if(!node.data.editable){
                notify('error', { detail: 'файл не редактируется!' }, true);
            } else {
                // Отправляем событие только с информацией о файле
                // Содержимое файла будет запрошено в компоненте FileContent
                emit('select-file', {
                    file: node.data,
                    mediaSource: node.data.sourceId
                });
            }
        }
    }
    
    // Состояние для диалогов
    const renameDialog = ref(false);
    const createFileDialog = ref(false);
    const createDirDialog = ref(false);
    const deleteDialog = ref(false);
    const uploadDialog = ref(false);
    
    // Данные для действий
    const renameItem = ref({ node: null, newName: '' });
    const createItem = ref({ parentNode: null, name: '', type: '' });
    const deleteItem = ref({ node: null, name: '', path: '' });
    const uploadItem = ref({ parentNode: null, files: [] });
    
    // Обработчик действий
    const handleAction = async (action) => {
        const { type, node } = action;
        
        switch (type) {
            case 'refresh':
                // Обновить содержимое директории
                if (node.data.is_dir) {
                    await toggleNode(node);
                }
                break;
                
            case 'rename':
                // Открыть диалог переименования
                renameItem.value = {
                    node: node,
                    newName: node.title
                };
                renameDialog.value = true;
                break;
                
            case 'delete':
                // Открыть диалог удаления
                deleteItem.value = {
                    node: node,
                    name: node.title,
                    path: node.data.path
                };
                deleteDialog.value = true;
                break;
                
            case 'create-file':
                // Открыть диалог создания файла
                createItem.value = {
                    parentNode: node,
                    name: '',
                    type: 'file'
                };
                createFileDialog.value = true;
                break;
                
            case 'create-directory':
                // Открыть диалог создания директории
                createItem.value = {
                    parentNode: node,
                    name: '',
                    type: 'directory'
                };
                createDirDialog.value = true;
                break;
                
            case 'upload':
                // Открыть диалог загрузки файлов
                uploadItem.value = {
                    parentNode: node,
                    files: []
                };
                uploadDialog.value = true;
                break;
                
            case 'download':
                // Скачать файл
                await downloadFile(node);
                break;
                
            case 'copy-path':
                // Копировать путь в буфер обмена
                navigator.clipboard.writeText(node.data.path)
                    .then(() => {
                        notify('success', { detail: 'Путь скопирован в буфер обмена' }, true);
                    })
                    .catch(err => {
                        notify('error', { detail: 'Не удалось скопировать путь: ' + err.message }, true);
                    });
                break;
        }
    };
    
    // Функция для скачивания файла
    const downloadFile = async (node) => {
        try {
            const response = await fileService.downloadFile(node.data.path, node.data.sourceId);
            
            if (response.success !== 1) {
                notify('error', { detail: response.message || 'Ошибка при скачивании файла' }, true);
                return;
            }
            
            // Создаем ссылку для скачивания
            const blob = response.data;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = node.title;
            document.body.appendChild(a);
            a.click();
            
            // Очищаем ресурсы
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            notify('error', { detail: error.message }, true);
        }
    };
    
    // Подтверждение переименования
    const confirmRename = async () => {
        try {
            if (!renameItem.value.newName.trim()) {
                notify('error', { detail: 'Имя не может быть пустым' }, true);
                return;
            }
            
            // Если это директория, добавляем слеш в конце пути
            let path = renameItem.value.node.data.path;
            if (renameItem.value.node.data.is_dir && !path.endsWith('/')) {
                path += '/';
            }
            
            const response = await fileService.rename(
                path, 
                renameItem.value.newName,
                renameItem.value.node.data.sourceId
            );
            
            if (response.success === 1) {
                notify('success', { detail: 'Файл успешно переименован' }, true);
                // Перезагрузить дерево
                if (currentSource.value) {
                    await loadTree(currentPath.value, currentSource.value);
                } else {
                    await loadTree();
                }
            } else {
                notify('error', { detail: response.message || 'Ошибка при переименовании' }, true);
            }
            
            renameDialog.value = false;
        } catch (error) {
            notify('error', { detail: error.message }, true);
        }
    };
    
    // Подтверждение создания файла
    const confirmCreateFile = async () => {
        try {
            if (!createItem.value.name.trim()) {
                notify('error', { detail: 'Имя не может быть пустым' }, true);
                return;
            }
            
            let parentPath = createItem.value.parentNode.data.path;
            // Добавляем завершающий слеш, если его нет
            if (!parentPath.endsWith('/')) {
                parentPath = parentPath + '/';
            }
            const newPath = `${parentPath}${createItem.value.name}`;
            const sourceId = createItem.value.parentNode.data.sourceId;
            
            const response = await fileService.createFile(
                parentPath,
                createItem.value.name,
                '',  // Пустое содержимое
                sourceId
            );
            
            if (response.success === 1) {
                notify('success', { detail: 'Файл успешно создан' }, true);
                // Перезагрузить дерево
                if (currentSource.value) {
                    await loadTree(currentPath.value, currentSource.value);
                } else {
                    await loadTree();
                }
            } else {
                notify('error', { detail: response.message || 'Ошибка при создании файла' }, true);
            }
            
            createFileDialog.value = false;
        } catch (error) {
            notify('error', { detail: error.message }, true);
        }
    };
    
    // Подтверждение создания директории
    const confirmCreateDir = async () => {
        try {
            if (!createItem.value.name.trim()) {
                notify('error', { detail: 'Имя не может быть пустым' }, true);
                return;
            }
            
            let parentPath = createItem.value.parentNode.data.path;
            // Добавляем завершающий слеш, если его нет
            if (!parentPath.endsWith('/')) {
                parentPath = parentPath + '/';
            }
            const name = createItem.value.name;
            const sourceId = createItem.value.parentNode.data.sourceId;
            
            const response = await fileService.createDirectory(
                parentPath,
                name,
                sourceId
            );
            
            if (response.success === 1) {
                notify('success', { detail: 'Директория успешно создана' }, true);
                // Перезагрузить дерево
                if (currentSource.value) {
                    await loadTree(currentPath.value, currentSource.value);
                } else {
                    await loadTree();
                }
            } else {
                notify('error', { detail: response.message || 'Ошибка при создании директории' }, true);
            }
            
            createDirDialog.value = false;
        } catch (error) {
            notify('error', { detail: error.message }, true);
        }
    };
    
    // Подтверждение удаления
    const confirmDelete = async () => {
        try {
            // Если это директория, добавляем слеш в конце пути
            let path = deleteItem.value.path;
            if (deleteItem.value.node.data.is_dir && !path.endsWith('/')) {
                path += '/';
            }
            
            const sourceId = deleteItem.value.node.data.sourceId;
            
            const response = await fileService.remove(
                path,
                sourceId
            );
            
            if (response.success === 1) {
                notify('success', { detail: 'Успешно удалено' }, true);
                // Перезагрузить дерево
                if (currentSource.value) {
                    await loadTree(currentPath.value, currentSource.value);
                } else {
                    await loadTree();
                }
            } else {
                notify('error', { detail: response.message || 'Ошибка при удалении' }, true);
            }
            
            deleteDialog.value = false;
        } catch (error) {
            notify('error', { detail: error.message }, true);
        }
    };
    
    // Обработка выбора файлов для загрузки
    const handleFileUpload = (event) => {
        uploadItem.value.files = event.target.files;
    };
    
    // Подтверждение загрузки файлов
    const confirmUpload = async () => {
        try {
            if (!uploadItem.value.files || uploadItem.value.files.length === 0) {
                notify('error', { detail: 'Не выбраны файлы для загрузки' }, true);
                return;
            }
            
            let parentPath = uploadItem.value.parentNode.data.path;
            // Добавляем завершающий слеш, если его нет
            if (!parentPath.endsWith('/')) {
                parentPath = parentPath + '/';
            }
            const sourceId = uploadItem.value.parentNode.data.sourceId;
            
            for (let i = 0; i < uploadItem.value.files.length; i++) {
                const file = uploadItem.value.files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('path', parentPath);
                
                const response = await fileService.uploadFile(
                    file,
                    parentPath,
                    sourceId
                );
                
                if (response.success !== 1) {
                    notify('error', { detail: `Ошибка при загрузке файла ${file.name}: ${response.message}` }, true);
                }
            }
            
            notify('success', { detail: 'Файлы успешно загружены' }, true);
            // Перезагрузить дерево
            if (currentSource.value) {
                await loadTree(currentPath.value, currentSource.value);
            } else {
                await loadTree();
            }
            
            uploadDialog.value = false;
        } catch (error) {
            notify('error', { detail: error.message }, true);
        }
    };
    
    // Функция для получения иконки файла
    const getFileIcon = (file) => {
        if (!file.ext) return 'pi pi-file';
        
        const ext = file.ext.toLowerCase();
        
        switch (ext) {
            case 'pdf':
                return 'pi pi-file-pdf';
            case 'doc':
            case 'docx':
                return 'pi pi-file-word';
            case 'xls':
            case 'xlsx':
                return 'pi pi-file-excel';
            case 'ppt':
            case 'pptx':
                return 'pi pi-file-powerpoint';
            case 'zip':
            case 'rar':
            case '7z':
                return 'pi pi-file-archive';
            case 'txt':
                return 'pi pi-file-text';
            case 'html':
            case 'htm':
            case 'css':
            case 'js':
            case 'php':
            case 'vue':
            case 'jsx':
            case 'ts':
            case 'tsx':
                return 'pi pi-file-code';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'bmp':
            case 'svg':
            case 'webp':
                return 'pi pi-image';
            case 'mp3':
            case 'wav':
            case 'ogg':
            case 'flac':
                return 'pi pi-volume-up';
            case 'mp4':
            case 'avi':
            case 'mov':
            case 'wmv':
            case 'mkv':
                return 'pi pi-video';
            default:
                return 'pi pi-file';
        }
    }
    
    

    const filteredNodes = ref([])
    const expandedNodes = ref([])
    
    // Функция для фильтрации узлов дерева
    const filterTree = (searchText) => {
        // Создаем глубокую копию узлов
        const nodesCopy = JSON.parse(JSON.stringify(nodes.value))
        
        // Если поисковый запрос пустой, применяем только фильтр по скрытым файлам
        if (!searchText) {
            if (showHidden.value) {
                // Если ToggleButton включен (показывать все), возвращаем все узлы
                filteredNodes.value = JSON.parse(JSON.stringify(nodesCopy))
                setTimeout(() => {
                    expandTree()
                }, 0);
            } else {
                // Если ToggleButton выключен (скрывать скрытые файлы), фильтруем скрытые файлы
                const filterHiddenNodes = (nodeList) => {
                    return nodeList.filter(node => {
                        // Фильтруем скрытые файлы
                        if (node.data && node.data.hidden) {
                            return false
                        }
                        
                        // Фильтруем дочерние элементы
                        if (node.children && node.children.length) {
                            node.children = filterHiddenNodes(node.children)
                        }
                        
                        return true
                    })
                }
                
                filteredNodes.value = filterHiddenNodes(nodesCopy)
                setTimeout(() => {
                    expandTree()
                }, 0);
            }
            return
        }
        
        searchText = searchText.toLowerCase()
        
        // Рекурсивная функция для фильтрации узлов
        const filterNodes = (nodeList) => {
            return nodeList.filter(node => {
                // Проверяем скрытость файла, если ToggleButton выключен (скрывать скрытые файлы)
                if (!showHidden.value && node.data && node.data.hidden) {
                    return false;
                }
                
                // Проверяем, содержит ли заголовок узла поисковый текст
                const titleMatch = node.title.toLowerCase().includes(searchText)
                
                // Если у узла есть дочерние элементы, фильтруем их
                let children = []
                if (node.children && node.children.length) {
                    children = filterNodes(node.children)
                }
                
                // Если заголовок содержит поисковый текст или есть подходящие дочерние элементы
                if (titleMatch || children.length > 0) {
                    // Создаем копию узла с отфильтрованными дочерними элементами
                    const newNode = { ...node }
                    
                    // Устанавливаем isExpanded = true для всех узлов, которые либо сами содержат совпадения,
                    // либо имеют дочерние элементы с совпадениями
                    expandedNodes.value.push(node.data.id)

                    if (children.length > 0) {
                        newNode.children = children
                    }
                    
                    return true
                }
                
                return false
            })
        }
        
        // Фильтруем корневые узлы
        filteredNodes.value = filterNodes(nodesCopy)
        slVueTree.value.traverse((node, nodeModel, path) => {
            if(expandedNodes.value.includes(node.data.id)){
                expanded[node.pathStr] = node.path
            }
        })
        setTimeout(() => {
            expandTree()
        }, 0);
    }
    
    // Функция для форматирования текста
    const highlightText = (node) => {
        let text = node.title
        if(node.data.hidden){
            text = '<em>' + text + '</em>'
        }
        return text
    }
    
    // Функция для применения фильтров при изменении состояния ToggleButton
    const applyFilters = () => {
        filterTree('')
    }
    
    
    // Добавляем метод для получения содержимого файла
    const getFileContent = async (path, sourceId) => {
        try {
            const response = await fileService.getFileContent(path, sourceId);
            return response;
        } catch (error) {
            notify('error', { detail: error.message }, true);
            return null;
        }
    }
    // Функция для обновления дерева
    const refresh = () => {
        loadTree();
    };
    defineExpose({ refresh, getFileContent });
</script>
<style>
    @import 'sl-vue-tree-next/sl-vue-tree-next-minimal.css';
    .sl-vue-tree-next-root{
      font-size: x-large;
    }
    .file-tree{
        height: 100%; 
        width: 100%; 
        overflow: auto;
    }
    .node-icon {
        display: inline-flex;
        align-items: center;
        margin-right: 5px;
        vertical-align: middle;
    }
    .file-tree .p-togglebutton-label{
        display:none;
    }
    
    .tree-controls {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 0.5rem;
        gap: 0.5rem;
    }
</style>
