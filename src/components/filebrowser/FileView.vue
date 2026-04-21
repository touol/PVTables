<template>
  <div class="file-view">
    <!-- Панель инструментов -->
    <Toolbar class="mb-4">
      <template #start>
        <div class="fv-toolbar-start">
          <span class="p-input-icon-left fv-search">
            <i class="pi pi-search" />
            <InputText
              v-model="filter"
              placeholder="Поиск файлов"
              @input="onFilterChange"
            />
          </span>

          <div class="fv-sort">
            <span class="fv-sort-label">Сортировка:</span>
            <Button
              :class="{ 'p-button-outlined': sortField !== 'name' }"
              @click="setSortField('name')"
            >
              Имя
              <i v-if="sortField === 'name'" :class="getSortIcon()"></i>
            </Button>
            <Button
              :class="{ 'p-button-outlined': sortField !== 'size' }"
              @click="setSortField('size')"
            >
              Размер
              <i v-if="sortField === 'size'" :class="getSortIcon()"></i>
            </Button>
            <Button
              :class="{ 'p-button-outlined': sortField !== 'lastmod' }"
              @click="setSortField('lastmod')"
            >
              Дата
              <i v-if="sortField === 'lastmod'" :class="getSortIcon()"></i>
            </Button>
          </div>
        </div>
      </template>
      
      <template #end>
        <div class="flex items-center">
          <Button 
            icon="pi pi-th-large" 
            :class="{ 'p-button-outlined': viewMode !== 'grid' }"
            @click="setViewMode('grid')"
            class="mr-2"
          />
          <Button 
            icon="pi pi-list" 
            :class="{ 'p-button-outlined': viewMode !== 'list' }"
            @click="setViewMode('list')"
          />
        </div>
      </template>
    </Toolbar>
    
    <!-- Отображение файлов в режиме сетки -->
    <div v-if="viewMode === 'grid'" class="grid-view">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <i class="pi pi-spin pi-spinner text-4xl"></i>
      </div>
      
      <div v-else-if="filesOnly.length === 0" class="flex justify-center items-center h-64">
        <div class="text-center">
          <i class="pi pi-folder-open text-4xl mb-2"></i>
          <p>Нет файлов для отображения</p>
        </div>
      </div>
      
      <div v-else class="grid grid-cols-4 gap-4">
        <div 
          v-for="file in filesOnly" 
          :key="file.name"
          class="file-item p-2 rounded-lg cursor-pointer"
          :class="{ 'selected': isSelected(file) }"
          @click="selectFile(file)"
          @dblclick="onFileDoubleClick(file)"
        >
          <div class="flex flex-col items-center">
            <div class="file-icon mb-2">
              <img 
                v-if="isImage(file)" 
                :src="file.thumb || file.url" 
                :alt="file.name"
                class="w-24 h-24 object-cover rounded"
              />
              <i v-else :class="getFileIcon(file)" class="text-4xl"></i>
            </div>
            <div class="file-name text-center truncate w-full">
              {{ file.name }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Отображение файлов в режиме списка -->
    <div v-else class="list-view">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <i class="pi pi-spin pi-spinner text-4xl"></i>
      </div>
      
      <div v-else-if="filesOnly.length === 0" class="flex justify-center items-center h-64">
        <div class="text-center">
          <i class="pi pi-folder-open text-4xl mb-2"></i>
          <p>Нет файлов для отображения</p>
        </div>
      </div>
      
      <div v-else>
        <DataTable 
          :value="filesOnly" 
          :rowHover="true"
          selectionMode="single"
          v-model:selection="selectedFile"
          @row-dblclick="onFileDoubleClick"
          class="p-datatable-sm"
        >
          <Column field="name" header="Имя">
            <template #body="slotProps">
              <div class="flex items-center">
                <i v-if="!isImage(slotProps.data)" :class="getFileIcon(slotProps.data)" class="mr-2"></i>
                <img 
                  v-else 
                  :src="slotProps.data.thumb || slotProps.data.url" 
                  :alt="slotProps.data.name"
                  class="w-8 h-8 object-cover rounded mr-2"
                />
                {{ slotProps.data.name }}
              </div>
            </template>
          </Column>
          <Column field="size" header="Размер">
            <template #body="slotProps">
              {{ formatFileSize(slotProps.data.size) }}
            </template>
          </Column>
          <Column field="lastmod" header="Дата изменения">
            <template #body="slotProps">
              {{ formatDate(slotProps.data.lastmod) }}
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue';
import Toolbar from 'primevue/toolbar';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import FileService from '../../services/FileService';
import fileStore from '../../store/fileStore';

// Сервис для работы с файлами
const fileService = new FileService();

// Получаем родительский компонент FileBrowser для доступа к его пропсам и эмитам
const fileBrowser = inject('fileBrowser', null);

// Состояние из хранилища
const { state, filteredFiles, actions } = fileStore;

// Локальные вычисляемые свойства
const loading = computed(() => state.loading);
const viewMode = computed(() => state.viewMode);
const sortField = computed(() => state.sortField);
const sortOrder = computed(() => state.sortOrder);
const filter = ref(state.filter);
const selectedFile = computed({
  get: () => state.selectedFile,
  set: (value) => actions.selectFile(value)
});

// На узких экранах (< 768px) дерево папок скрыто — показываем папки прямо
// в списке, чтобы можно было проваливаться внутрь. На десктопе — только файлы.
const isNarrow = ref(false)
const updateNarrow = () => { isNarrow.value = typeof window !== 'undefined' && window.innerWidth < 768 }
if (typeof window !== 'undefined') {
  updateNarrow()
  window.addEventListener('resize', updateNarrow)
}

const filesOnly = computed(() => {
  if (isNarrow.value) {
    // Сортируем так, чтобы папки были сверху
    return [...filteredFiles.value].sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1
      if (!a.is_dir && b.is_dir) return 1
      return 0
    })
  }
  return filteredFiles.value.filter(file => !file.is_dir);
});

// Методы
const onFilterChange = () => {
  actions.setFilter(filter.value);
};

const setSortField = (field) => {
  actions.setSortField(field);
};

const setViewMode = (mode) => {
  actions.setViewMode(mode);
};

const selectFile = (file) => {
  actions.selectFile(file);
};

const isSelected = (file) => {
  return state.selectedFile && state.selectedFile.name === file.name;
};

const onFileDoubleClick = (file) => {
  // Директория — проваливаемся внутрь (удобно на мобильном без дерева)
  if (file.is_dir) {
    const target = (state.currentDirectory || '/').replace(/\/$/, '') + '/' + file.name + '/';
    fileStore.actions.loadFiles(target, state.mediaSource);
    return;
  }
  // Файл в режиме выбора — эмитим выбор
  if (fileBrowser && fileBrowser.selectionMode) {
    const filePath = file.url || (state.currentDirectory + file.name);
    fileBrowser.emit('fileSelected', filePath);
  }
};

const getSortIcon = () => {
  return sortOrder.value === 1 ? 'pi pi-sort-up' : 'pi pi-sort-down';
};

const isImage = (file) => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  return file.ext && imageExtensions.includes(file.ext.toLowerCase());
};

const getFileIcon = (file) => {
  const ext = file.ext ? file.ext.toLowerCase() : '';
  
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
      return 'pi pi-file-code';
    default:
      return 'pi pi-file';
  }
};

const formatFileSize = (size) => {
  return fileService.formatFileSize(size);
};

const formatDate = (date) => {
  return fileService.formatDate(date);
};

// Файлы загружаются в DirectoryTree.vue, поэтому здесь не нужно их загружать
</script>

<style scoped>
.file-view {
  height: 100%;
  overflow: auto;
}

.grid-view {
  padding: 1rem;
}

.file-item {
  transition: all 0.2s;
  border: 1px solid transparent;
}

.file-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.file-item.selected {
  background-color: rgba(0, 0, 0, 0.1);
  border-color: var(--primary-color, #3B82F6);
}

.file-name {
  max-width: 100%;
  font-size: 0.9rem;
}

/* Toolbar start — собственный layout, поиск + сортировка */
.fv-toolbar-start {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  width: 100%;
}
.fv-search {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.fv-search > i.pi-search {
  position: absolute;
  left: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: #6b7280;
}
.fv-search :deep(.p-inputtext) { padding-left: 2rem; }

.fv-sort {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.fv-sort-label { font-size: 0.9rem; }

/* ── Мобильный вид (≤ 768px) ── */
@media (max-width: 768px) {
  .fv-toolbar-start {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  .fv-search { width: 100%; }
  .fv-search :deep(.p-inputtext) { width: 100%; }

  .fv-sort {
    display: grid;
    grid-template-columns: auto repeat(3, minmax(0, 1fr));
    gap: 0.25rem;
    align-items: center;
    width: 100%;
  }
  .fv-sort :deep(.p-button) {
    padding: 0.35rem 0.4rem;
    font-size: 0.85rem;
    justify-content: center;
    white-space: nowrap;
  }

  /* Сетка файлов — 2 колонки вместо 4 */
  .file-view .grid.grid-cols-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
</style>
