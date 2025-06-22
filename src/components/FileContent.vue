<template>
  <div class="file-content">
    <div v-if="loading" class="loading">
      <i class="pi pi-spin pi-spinner text-4xl"></i>
      <p>Загрузка содержимого файла...</p>
    </div>
    <div v-else-if="error" class="error">
      <i class="pi pi-exclamation-triangle text-4xl"></i>
      <p>{{ error }}</p>
    </div>
    <div v-else class="content-wrapper">
      <!-- Информация о файле -->
      <div class="file-info mb-4">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">{{ fileName }}</h2>
          <div class="flex gap-2">
            <Button 
              icon="pi pi-download" 
              class="p-button-text"
              @click="downloadFile"
              tooltip="Скачать файл"
            />
            <Button 
              icon="pi pi-copy" 
              class="p-button-text"
              @click="copyContent"
              tooltip="Копировать содержимое"
            />
          </div>
        </div>
        <div class="text-sm text-gray-500">
          <span v-if="fileSize">Размер: {{ formatFileSize(fileSize) }} | </span>
          <span v-if="lastModified">Изменен: {{ formatDate(lastModified) }}</span>
        </div>
      </div>
      
      <!-- Содержимое файла -->
      <div class="file-content-display">
        <!-- Текстовый редактор -->
        <div class="edit-preview">
          <div class="toolbar mb-2 flex justify-between">
            <div>
              <Button 
                icon="pi pi-save" 
                label="Сохранить"
                class="p-button-sm mr-2"
                @click="saveContent"
                :loading="saving"
              />
            </div>
          </div>
          <Textarea 
            v-model="editedContent" 
            class="w-full editor-textarea" 
            :autoResize="false"
            :disabled="saving"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import FileService from '../services/FileService';
import { useNotifications } from "./useNotifications";

const props = defineProps({
  file: {
    type: Object,
    default: null
  },
  content: {
    type: String,
    default: ''
  },
  mime: {
    type: String,
    default: ''
  },
  mediaSource: {
    type: Number,
    default: 1
  }
});

const fileService = new FileService();
const { notify } = useNotifications();

const loading = ref(false);
const saving = ref(false);
const error = ref(null);
const fileContent = ref(props.content || '');
const editedContent = ref('');

// Вычисляемые свойства
const fileName = computed(() => props.file ? props.file.path : '');
const fileSize = computed(() => props.file ? props.file.size : null);
const lastModified = computed(() => props.file ? props.file.lastmod : null);

// Методы
const loadContent = async () => {
  if (!props.file) return;
  
  try {
    loading.value = true;
    error.value = null;
    
    // Загружаем содержимое текстового файла
    const response = await fileService.getFileContent(props.file.path, props.mediaSource);
    if (response && response.success === 1) {
      fileContent.value = response.data.content;
      editedContent.value = response.data.content;
    } else {
      error.value = response ? response.message : 'Ошибка при загрузке содержимого файла';
    }
  } catch (err) {
    error.value = err.message || 'Ошибка при загрузке содержимого файла';
    notify('error', { detail: error.value }, true);
  } finally {
    loading.value = false;
  }
};

const downloadFile = async () => {
  if (!props.file) return;
  
  try {
    loading.value = true;
    
    const response = await fileService.downloadFile(props.file.path, props.mediaSource);
    
    if (response.success !== 1) {
      notify('error', { detail: response.message || 'Ошибка при скачивании файла' }, true);
      return;
    }
    
    // Создаем ссылку для скачивания
    const blob = response.data;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.value;
    document.body.appendChild(a);
    a.click();
    
    // Очищаем ресурсы
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    notify('error', { detail: err.message }, true);
  } finally {
    loading.value = false;
  }
};

const copyContent = () => {
  if (!fileContent.value) return;
  
  navigator.clipboard.writeText(fileContent.value)
    .then(() => {
      notify('success', { detail: 'Содержимое скопировано в буфер обмена' }, true);
    })
    .catch(err => {
      notify('error', { detail: 'Не удалось скопировать содержимое: ' + err.message }, true);
    });
};

const formatFileSize = (size) => {
  return fileService.formatFileSize(size);
};

const formatDate = (date) => {
  return fileService.formatDate(date);
};


// Наблюдатели
watch(() => props.file, (newFile) => {
  if (newFile) {
    loadContent();
  } else {
    fileContent.value = '';
    editedContent.value = '';
    error.value = null;
  }
}, { immediate: true });

// Если mediaSource изменился, перезагружаем содержимое
watch(() => props.mediaSource, (newMediaSource) => {
  if (props.file) {
    loadContent();
  }
});

// Очистка ресурсов при размонтировании компонента
onMounted(() => {
  if (props.file) {
    loadContent();
  }
});


const saveContent = async () => {
  if (!props.file) return;
  
  try {
    saving.value = true;
    
    const response = await fileService.saveFileContent(
      props.file.path, 
      editedContent.value, 
      props.mediaSource
    );
    
    if (response.success === 1) {
      fileContent.value = editedContent.value;
      // notify('success', { detail: 'Файл успешно сохранен' }, true);
    } else {
      // notify('error', { detail: response.message || 'Ошибка при сохранении файла' }, true);
    }
  } catch (err) {
    notify('error', { detail: err.message || 'Ошибка при сохранении файла' }, true);
  } finally {
    saving.value = false;
  }
};

// Экспортируем методы для внешнего использования
const refresh = () => {
  loadContent();
};

const getFileContent = async () => {
  try {
    const response = await fileService.getFileContent(props.file.path, props.mediaSource);
    return response;
  } catch (error) {
    notify('error', { detail: error.message }, true);
    return null;
  }
};

defineExpose({ refresh, getFileContent });
</script>

<style scoped>
.file-content {
  height: 100%;
  width: 100%;
  overflow: hidden;
  padding: 1rem;
}

.loading, .error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.content-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.file-content-display {
  flex: 1;
  width: 100%;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}


.edit-preview {
  height: 100%;
  
}

.editor-textarea {
  flex: 1;
  font-family: monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  height: 100%;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
}

</style>
