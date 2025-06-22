<template>
  <div class="directory-tree">
    <Tree
      :value="treeNodes"
      :expandedKeys="expandedKeys"
      selectionMode="single"
      :selectionKeys="selectedNodeKey"
      @node-select="onNodeSelect"
      @node-expand="onNodeExpand"
      @node-collapse="onNodeCollapse"
      class="w-full"
    >
      <template #default="slotProps">
        <div class="flex items-center">
          <i :class="getNodeIcon(slotProps.node)" class="mr-2"></i>
          <span>{{ slotProps.node.label }}</span>
        </div>
      </template>
    </Tree>
    <div v-if="loading" class="flex justify-center mt-2">
      <i class="pi pi-spin pi-spinner text-2xl"></i>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import Tree from 'primevue/tree';
import FileService from '../../services/FileService';
import fileStore from '../../store/fileStore';

const props = defineProps({
  mediaSource: {
    type: Number,
    default: 1
  },
  initialPath: {
    type: String,
    default: ''
  }
});

// Состояние
const fileService = new FileService();
const treeNodes = ref(null);
const selectedNodeKey = ref({});
const expandedKeys = ref({ '/': true }); // Корневой узел раскрыт по умолчанию
const loading = ref(false);

// Загрузка директорий
const loadDirectories = async (parentPath = '/', parentNode = null) => {
  try {
    loading.value = true;
    
    // Если это корневой уровень, загружаем файлы и директории одним запросом
    if (!parentNode) {
      // Загружаем файлы и директории через хранилище
      await fileStore.actions.loadFiles(parentPath, props.mediaSource);
      
      // Получаем директории из хранилища
      const directories = fileStore.state.files.filter(file => file.is_dir);
      
      // Преобразуем директории в формат для дерева
      const nodes = directories.map(dir => ({
        key: parentPath + dir.name + '/',
        label: dir.name,
        data: dir,
        leaf: false,
        children: [],
        expanded: false
      }));

      // Создаем корневой узел
      const rootNode = {
        key: '/',
        label: 'Корень',
        data: { name: 'Корень' },
        leaf: false,
        children: nodes,
        expanded: true
      };
      
      
      // Добавляем корневой узел
      treeNodes.value = [rootNode];
      
      // Выбираем корневой узел по умолчанию
      selectedNodeKey.value = { '/': true };
      
      // setTimeout(() => {
      //       treeNodes.value[0].expanded = true
      //   }, 500);
      // await loadDirectories('/', treeNodes.value[0]);
    } else {
      // Для вложенных директорий используем отдельный запрос
      const result = await fileService.getDirectories(parentPath, props.mediaSource);
      
      // Преобразуем директории в формат для дерева
      const nodes = result.directories.map(dir => ({
        key: parentPath + dir.name + '/',
        label: dir.name,
        data: dir,
        leaf: false,
        children: [],
        expanded: false
      }));
      
      // Добавляем узлы как дочерние к родительскому узлу
      parentNode.children = nodes;
      
      // Раскрываем родительский узел через expandedKeys
      expandedKeys.value[parentNode.key] = true;
    }
  } catch (error) {
    console.error('Ошибка при загрузке директорий:', error);
  } finally {
    loading.value = false;
  }
};

// Обработчик выбора узла
const onNodeSelect = async (node) => {
  selectedNodeKey.value = { [node.key]: true };
  
  // Сначала загружаем файлы для выбранной директории
  await fileStore.actions.loadFiles(node.key, props.mediaSource);
  
  // Затем создаем объект директории для выбора в хранилище
  if (node.key !== '/') {
    // Ищем директорию в списке файлов
    const dirFromList = fileStore.state.files.find(f => f.is_dir && f.name === node.label);
    
    if (dirFromList) {
      // Если директория найдена в списке, выбираем её
      fileStore.actions.selectFile(dirFromList);
    } else {
      // Иначе создаем новый объект директории
      const dirObject = {
        name: node.label,
        is_dir: true,
        path: node.key
      };
      fileStore.actions.selectFile(dirObject);
    }
  }
};

// Обработчик раскрытия узла
const onNodeExpand = async (node) => {
  // Если у узла нет дочерних элементов или они не загружены, загружаем их
  if (!node.children || node.children.length === 0) {
    await loadDirectories(node.key, node);
  }
  
  // Добавляем узел в список раскрытых
  expandedKeys.value[node.key] = true;
  
  // Выбираем узел
  selectedNodeKey.value = { [node.key]: true };
  
  // Загружаем файлы для этой директории
  fileStore.actions.loadFiles(node.key, props.mediaSource);
};

// Обработчик сворачивания узла
const onNodeCollapse = (node) => {
  // Удаляем узел из списка раскрытых
  delete expandedKeys.value[node.key];
};

// Получение иконки для узла
const getNodeIcon = (node) => {
  if (node.expanded) {
    return 'pi pi-folder-open';
  }
  return 'pi pi-folder';
};

// Функция для разбора пути на компоненты
const parsePathComponents = (path) => {
  if (!path) return [];
  
  // Удаляем имя файла, если оно есть (оставляем только путь к директории)
  const dirPath = path.includes('.') ? path.substring(0, path.lastIndexOf('/') + 1) : path;
  
  // Разбиваем путь на компоненты
  const components = dirPath.split('/').filter(c => c);
  
  // Формируем массив путей для каждого уровня
  const paths = [];
  let currentPath = '/';
  paths.push(currentPath);
  
  for (const component of components) {
    currentPath += component + '/';
    paths.push(currentPath);
  }
  
  return paths;
};

// Функция для раскрытия дерева до указанной папки
const expandToPath = async (paths) => {
  if (!paths.length) return;
  
  // Загружаем корневые директории
  await loadDirectories();
  
  // Находим корневой узел
  const rootNode = treeNodes.value[0];
  
  // Явно раскрываем корневой узел через expandedKeys
  expandedKeys.value['/'] = true;
  
  // Пропускаем корневую директорию (она уже раскрыта)
  const pathsToExpand = paths.slice(1);
  
  // Рекурсивно раскрываем узлы
  if (pathsToExpand.length > 0) {
    await expandNodePath(rootNode, pathsToExpand, 0);
  } else {
    // Если путь содержит только корневую директорию, выбираем её
    selectedNodeKey.value = { [rootNode.key]: true };
    fileStore.actions.loadFiles(rootNode.key, props.mediaSource);
  }
};

// Рекурсивная функция для раскрытия узлов
const expandNodePath = async (node, paths, level) => {
  if (level >= paths.length) return;
  
  // Текущий путь для этого уровня
  const currentPath = paths[level];
  
  // Извлекаем имя директории из пути
  const pathParts = currentPath.split('/').filter(p => p);
  const dirName = pathParts[pathParts.length - 1];
  
  // Если у узла нет дочерних элементов, загружаем их
  if (!node.children || node.children.length === 0) {
    await loadDirectories(node.key, node);
  }
  
  // Сначала пробуем найти узел по ключу
  let childNode = node.children.find(child => child.key === currentPath);
  
  // Если не нашли по ключу, пробуем найти по имени директории
  if (!childNode) {
    childNode = node.children.find(child => child.label === dirName);
  }
  
  if (childNode) {
    // Раскрываем узел через expandedKeys
    expandedKeys.value[childNode.key] = true;
    
    // Загружаем файлы для этой директории
    fileStore.actions.loadFiles(childNode.key, props.mediaSource);
    
    // Если это последний уровень, выбираем узел
    if (level === paths.length - 1) {
      selectedNodeKey.value = { [childNode.key]: true };
    }
    
    // Рекурсивно раскрываем следующий уровень
    await expandNodePath(childNode, paths, level + 1);
  }
};

// При монтировании компонента загружаем корневые директории и раскрываем дерево до указанной папки
onMounted(async () => {
  if (props.initialPath) {
    const pathComponents = parsePathComponents(props.initialPath);
    await expandToPath(pathComponents);
  } else {
    await loadDirectories();
  }
});

// Отслеживаем изменение флага необходимости обновления дерева директорий
watch(() => fileStore.state.directoryTreeNeedsUpdate, async () => {
  console.log('Обновление дерева директорий');
  // Перезагружаем корневые директории
  await loadDirectories();
});
</script>

<style scoped>
.directory-tree {
  height: 100%;
  overflow: auto;
  padding: 0.5rem;
}
</style>
