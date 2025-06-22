<template>
  <div class="file-details p-4">
    <div v-if="!selectedFile" class="flex flex-col items-center justify-center h-full">
      <i class="pi pi-file text-4xl mb-2 text-gray-400"></i>
      <p class="text-gray-500">Выберите файл для просмотра деталей</p>
    </div>
    
    <div v-else class="flex flex-col h-full">
      <h3 class="text-xl font-semibold mb-4 truncate">{{ selectedFile.name }}</h3>
      
      <!-- Превью изображения -->
      <div v-if="isImage" class="mb-4 flex justify-center">
        <img 
          :src="selectedFile.image || selectedFile.url" 
          :alt="selectedFile.name"
          class="max-w-full max-h-64 object-contain rounded"
        />
      </div>
      
      <!-- Информация о файле -->
      <div class="file-info">
        <div class="info-item mb-2">
          <span class="font-semibold">Тип файла:</span>
          <span>{{ fileType }}</span>
        </div>
        
        <div class="info-item mb-2">
          <span class="font-semibold">Размер:</span>
          <span>{{ formattedSize }}</span>
        </div>
        
        <div v-if="isImage && selectedFile.image_width && selectedFile.image_height" class="info-item mb-2">
          <span class="font-semibold">Размеры:</span>
          <span>{{ selectedFile.image_width }} x {{ selectedFile.image_height }} px</span>
        </div>
        
        <div class="info-item mb-2">
          <span class="font-semibold">Последнее изменение:</span>
          <span>{{ formattedDate }}</span>
        </div>
        
        <div class="info-item mb-2">
          <span class="font-semibold">Путь:</span>
          <span class="truncate">{{ selectedFile.pathRelative || selectedFile.pathname }}</span>
        </div>
        
        <div v-if="selectedFile.url" class="info-item mb-2">
          <span class="font-semibold">URL:</span>
          <span class="truncate">{{ selectedFile.url }}</span>
        </div>
      </div>
      
      <!-- Кнопки действий -->
      <div class="actions mt-auto pt-4">
        <Button 
          label="Скачать" 
          icon="pi pi-download" 
          @click="downloadFile"
          class="mr-2"
        />
        <Button 
          label="Переименовать" 
          icon="pi pi-pencil" 
          @click="openRenameDialog"
          class="mr-2"
        />
        <Button 
          label="Удалить" 
          icon="pi pi-trash" 
          class="p-button-danger"
          @click="openRemoveDialog"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Button from 'primevue/button';
import FileService from '../../services/FileService';
import fileStore from '../../store/fileStore';

// Сервис для работы с файлами
const fileService = new FileService();

// Состояние из хранилища
const { state, actions } = fileStore;

// Выбранный файл
const selectedFile = computed(() => state.selectedFile);

// Проверка, является ли файл изображением
const isImage = computed(() => {
  if (!selectedFile.value) return false;
  
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  return selectedFile.value.ext && imageExtensions.includes(selectedFile.value.ext.toLowerCase());
});

// Тип файла
const fileType = computed(() => {
  if (!selectedFile.value) return '';
  
  if (selectedFile.value.cls && selectedFile.value.cls.includes('directory')) {
    return 'Директория';
  }
  
  const ext = selectedFile.value.ext ? selectedFile.value.ext.toLowerCase() : '';
  
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'Изображение JPEG';
    case 'png':
      return 'Изображение PNG';
    case 'gif':
      return 'Изображение GIF';
    case 'bmp':
      return 'Изображение BMP';
    case 'webp':
      return 'Изображение WebP';
    case 'svg':
      return 'Векторное изображение SVG';
    case 'pdf':
      return 'Документ PDF';
    case 'doc':
    case 'docx':
      return 'Документ Microsoft Word';
    case 'xls':
    case 'xlsx':
      return 'Таблица Microsoft Excel';
    case 'ppt':
    case 'pptx':
      return 'Презентация Microsoft PowerPoint';
    case 'zip':
      return 'Архив ZIP';
    case 'rar':
      return 'Архив RAR';
    case '7z':
      return 'Архив 7-Zip';
    case 'txt':
      return 'Текстовый файл';
    case 'html':
    case 'htm':
      return 'HTML-документ';
    case 'css':
      return 'Таблица стилей CSS';
    case 'js':
      return 'JavaScript-файл';
    case 'php':
      return 'PHP-скрипт';
    default:
      return ext ? `Файл ${ext.toUpperCase()}` : 'Файл';
  }
});

// Форматированный размер файла
const formattedSize = computed(() => {
  if (!selectedFile.value || !selectedFile.value.size) return 'Неизвестно';
  return fileService.formatFileSize(selectedFile.value.size);
});

// Форматированная дата изменения
const formattedDate = computed(() => {
  if (!selectedFile.value || !selectedFile.value.lastmod) return 'Неизвестно';
  return fileService.formatDate(selectedFile.value.lastmod);
});

// Методы
const downloadFile = () => {
  actions.downloadFile();
};

const openRenameDialog = () => {
  actions.openDialog('rename');
};

const openRemoveDialog = () => {
  actions.openDialog('remove');
};
</script>

<style scoped>
.file-details {
  height: 100%;
  overflow: auto;
  border-left: 1px solid #e2e8f0;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-item span:first-child {
  margin-bottom: 0.25rem;
}

.actions {
  border-top: 1px solid #e2e8f0;
}
</style>
