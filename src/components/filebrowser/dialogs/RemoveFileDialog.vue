<template>
  <Dialog
    v-model:visible="visible"
    :header="isDirectory ? 'Удаление директории' : 'Удаление файла'"
    :modal="true"
    :closable="true"
    :style="{ width: '400px' }"
    :dismissableMask="true"
  >
    <div class="remove-file-dialog">
      <div class="confirmation-message mb-4">
        <p v-if="isDirectory">
          Вы действительно хотите удалить директорию <strong>{{ fileName }}</strong>?
        </p>
        <p v-else>
          Вы действительно хотите удалить файл <strong>{{ fileName }}</strong>?
        </p>
        <p class="text-red-500 mt-2">Это действие нельзя отменить.</p>
        <p v-if="isDirectory" class="text-red-500">
          Все файлы и поддиректории внутри этой директории также будут удалены!
        </p>
      </div>
      
      <div v-if="error" class="error-message text-red-500 mb-4">
        {{ error }}
      </div>
    </div>
    
    <template #footer>
      <Button
        label="Отмена"
        icon="pi pi-times"
        @click="closeDialog"
        class="p-button-text"
      />
      <Button
        label="Удалить"
        icon="pi pi-trash"
        class="p-button-danger"
        @click="removeFile"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import fileStore from '../../../store/fileStore';

// Состояние из хранилища
const { state, actions } = fileStore;

// Локальное состояние
const error = ref('');

// Имя файла
const fileName = computed(() => {
  return state.selectedFile ? state.selectedFile.name : '';
});

// Проверка, является ли выбранный элемент директорией
const isDirectory = computed(() => {
  return state.selectedFile && state.selectedFile.is_dir;
});

// Видимость диалога
const visible = computed({
  get: () => state.dialogs.remove,
  set: (value) => {
    if (!value) {
      actions.closeDialog('remove');
    }
  }
});

// Сброс ошибки при открытии диалога
watch(() => state.dialogs.remove, (newValue) => {
  if (newValue) {
    error.value = '';
  }
});

// Удаление файла
const removeFile = async () => {
  try {
    await actions.removeFile();
    closeDialog();
  } catch (err) {
    error.value = `Ошибка при удалении ${isDirectory.value ? 'директории' : 'файла'}: ${err.message}`;
  }
};

// Закрытие диалога
const closeDialog = () => {
  actions.closeDialog('remove');
};
</script>

<style scoped>
.remove-file-dialog {
  padding: 1rem 0;
}
</style>
