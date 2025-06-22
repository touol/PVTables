<template>
  <div class="file-browser">
    <!-- Панель инструментов -->
    <div class="toolbar p-4 border-b">
      <div class="flex justify-between items-center">
        <div class="flex items-center">
          <h2 class="text-xl font-semibold mr-4">Менеджер файлов</h2>
          <div class="breadcrumb text-gray-500">
            {{ currentPath }}
          </div>
        </div>
        <div class="actions">
          <Button 
            icon="pi pi-upload" 
            label="Загрузить" 
            class="mr-2"
            @click="openUploadDialog"
          />
          <Button 
            icon="pi pi-folder" 
            label="Создать директорию" 
            class="mr-2"
            @click="openCreateDirectoryDialog"
          />
          <Button 
            icon="pi pi-trash" 
            label="Удалить директорию" 
            class="mr-2 p-button-danger"
            @click="openRemoveDirectoryDialog"
            :disabled="!state.selectedFile || !state.selectedFile.is_dir"
          />
          <Button 
            v-if="selectionMode"
            icon="pi pi-check" 
            label="Выбрать файл" 
            @click="selectCurrentFile"
            :disabled="!state.selectedFile || state.selectedFile.is_dir"
          />
        </div>
      </div>
    </div>
    
    <!-- Основной контент -->
    <div class="content-wrapper flex flex-1 overflow-hidden">
      <!-- Левая панель: дерево директорий -->
      <div class="directory-tree-panel w-1/4 border-r">
        <DirectoryTree :mediaSource="mediaSource" :initialPath="initialPath" />
      </div>
      
      <!-- Центральная панель: список файлов -->
      <div class="file-view-panel flex-1">
        <FileView />
      </div>
      
      <!-- Правая панель: детали файла -->
      <div class="file-details-panel w-1/4 border-l">
        <FileDetails />
      </div>
    </div>
    
    <!-- Диалоги -->
    <FileUploadDialog />
    <CreateDirectoryDialog />
    <RenameFileDialog />
    <RemoveFileDialog />
  </div>
  <Toast/>
</template>

<script setup>
import { computed, provide } from 'vue';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import DirectoryTree from './DirectoryTree.vue';
import FileView from './FileView.vue';
import FileDetails from './FileDetails.vue';
import FileUploadDialog from './dialogs/FileUploadDialog.vue';
import CreateDirectoryDialog from './dialogs/CreateDirectoryDialog.vue';
import RenameFileDialog from './dialogs/RenameFileDialog.vue';
import RemoveFileDialog from './dialogs/RemoveFileDialog.vue';
import fileStore from '../../store/fileStore';

// Пропсы
const props = defineProps({
  mediaSource: {
    type: Number,
    default: 1
  },
  selectionMode: {
    type: Boolean,
    default: false
  },
  initialPath: {
    type: String,
    default: ''
  }
});

// Эмиты
const emit = defineEmits(['fileSelected']);

// Предоставляем компонент FileBrowser для дочерних компонентов
provide('fileBrowser', {
  selectionMode: props.selectionMode,
  emit
});

// Состояние из хранилища
const { state, actions } = fileStore;

// Текущий путь
const currentPath = computed(() => {
  return state.currentDirectory;
});

// Методы
const openUploadDialog = () => {
  actions.openDialog('upload');
};

const openCreateDirectoryDialog = () => {
  actions.openDialog('createDirectory');
};

const openRemoveDirectoryDialog = () => {
  actions.openDialog('remove');
};

// Метод для выбора текущего файла и передачи его пути
const selectCurrentFile = () => {
  if (state.selectedFile && !state.selectedFile.is_dir) {
    const filePath = state.currentDirectory + state.selectedFile.name;
    emit('fileSelected', filePath);
  }
};
</script>

<style scoped>
.file-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.content-wrapper {
  height: calc(100% - 80px);
}

.directory-tree-panel,
.file-view-panel,
.file-details-panel {
  overflow: auto;
}

.breadcrumb {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
