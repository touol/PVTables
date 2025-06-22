<template>
  <Dialog
    v-model:visible="visible"
    :header="'Создание директории'"
    :modal="true"
    :closable="true"
    :style="{ width: '400px' }"
    :dismissableMask="true"
  >
    <div class="create-directory-dialog">
      <div class="field mb-4">
        <label for="directoryName" class="block mb-2">Имя директории</label>
        <InputText
          id="directoryName"
          v-model="directoryName"
          class="w-full"
          placeholder="Введите имя директории"
          @keydown.enter="createDirectory"
        />
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
        label="Создать"
        icon="pi pi-check"
        @click="createDirectory"
        :disabled="!isValid"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import fileStore from '../../../store/fileStore';

// Состояние из хранилища
const { state, actions } = fileStore;

// Локальное состояние
const directoryName = ref('');
const error = ref('');

// Видимость диалога
const visible = computed({
  get: () => state.dialogs.createDirectory,
  set: (value) => {
    if (!value) {
      actions.closeDialog('createDirectory');
    }
  }
});

// Валидация имени директории
const isValid = computed(() => {
  return directoryName.value.trim().length > 0 && !error.value;
});

// Сброс формы при открытии диалога
watch(() => state.dialogs.createDirectory, (newValue) => {
  if (newValue) {
    directoryName.value = '';
    error.value = '';
  }
});

// Валидация имени директории
watch(directoryName, (newValue) => {
  error.value = '';
  
  if (!newValue.trim()) {
    error.value = 'Имя директории не может быть пустым';
    return;
  }
  
  // Проверка на недопустимые символы
  const invalidChars = /[<>:"\/\\|?*]/;
  if (invalidChars.test(newValue)) {
    error.value = 'Имя директории содержит недопустимые символы: < > : " / \\ | ? *';
    return;
  }
});

// Создание директории
const createDirectory = async () => {
  if (!isValid.value) return;
  
  try {
    await actions.createDirectory(directoryName.value.trim());
    closeDialog();
  } catch (err) {
    error.value = 'Ошибка при создании директории: ' + err.message;
  }
};

// Закрытие диалога
const closeDialog = () => {
  actions.closeDialog('createDirectory');
};
</script>

<style scoped>
.create-directory-dialog {
  padding: 1rem 0;
}
</style>
