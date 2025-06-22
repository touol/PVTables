<template>
  <Dialog
    v-model:visible="visible"
    :header="'Загрузка файлов'"
    :modal="true"
    :closable="true"
    :style="{ width: '500px' }"
    :dismissableMask="true"
  >
    <div class="upload-dialog">
      <FileUpload
        name="file"
        :url="uploadUrl"
        :multiple="true"
        :auto="false"
        :customUpload="true"
        @uploader="onUpload"
        :maxFileSize="10000000"
        class="w-full"
      >
        <template #header="{ chooseCallback, uploadCallback, clearCallback, files }">
          <div class="flex flex-wrap justify-content-between align-items-center gap-2">
            <div class="flex gap-2">
              <Button
                @click="chooseCallback()"
                icon="pi pi-images"
                rounded
                outlined
                severity="help"
                label="Выбрать"
              />
              <Button
                @click="uploadCallback()"
                icon="pi pi-cloud-upload"
                rounded
                outlined
                severity="success"
                label="Загрузить"
                :disabled="!files || files.length === 0"
              />
            </div>
            <Button
              @click="clearCallback()"
              icon="pi pi-times"
              rounded
              outlined
              severity="danger"
              label="Очистить"
              :disabled="!files || files.length === 0"
            />
          </div>
        </template>
        <template #empty>
          <div class="flex flex-column align-items-center gap-3 py-5">
            <i class="pi pi-cloud-upload text-5xl text-primary"></i>
            <p class="text-lg">
              Перетащите файлы сюда или нажмите кнопку "Выбрать"
            </p>
          </div>
        </template>
        <template #content="{ files, uploadedFiles, removeUploadedFileCallback, removeFileCallback }">
          <div v-if="files.length > 0">
            <div v-for="(file, index) of files" :key="file.name + file.type + file.size" class="flex flex-wrap align-items-center gap-3 mb-2">
              <div class="flex align-items-center gap-2">
                <i class="pi pi-file text-lg"></i>
                <span class="font-semibold">{{ file.name }}</span>
              </div>
              <div class="flex gap-2 ml-auto">
                <span>{{ formatSize(file.size) }}</span>
                <Button
                  @click="removeFileCallback(index)"
                  icon="pi pi-times"
                  rounded
                  outlined
                  severity="danger"
                  class="p-button-sm"
                />
              </div>
            </div>
          </div>
        </template>
      </FileUpload>
    </div>
    
    <template #footer>
      <Button
        label="Закрыть"
        icon="pi pi-times"
        @click="closeDialog"
        class="p-button-text"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import FileUpload from 'primevue/fileupload';
import fileStore from '../../../store/fileStore';

// Состояние из хранилища
const { state, actions } = fileStore;

// Видимость диалога
const visible = computed({
  get: () => state.dialogs.upload,
  set: (value) => {
    if (!value) {
      actions.closeDialog('upload');
    }
  }
});

// URL для загрузки файлов
const uploadUrl = computed(() => {
  return '/connector.php';
});

// Форматирование размера файла
const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Обработчик загрузки файлов
const onUpload = async (event) => {
  const files = event.files;
  
  // Загружаем каждый файл
  for (let i = 0; i < files.length; i++) {
    try {
      await actions.uploadFile(files[i]);
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
    }
  }
  
  // Закрываем диалог после загрузки всех файлов
  closeDialog();
};

// Закрытие диалога
const closeDialog = () => {
  actions.closeDialog('upload');
};
</script>

<style scoped>
.upload-dialog {
  padding: 1rem 0;
}
</style>
