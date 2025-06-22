<template>
  <Dialog
    v-model:visible="visible"
    :header="'Переименование файла'"
    :modal="true"
    :closable="true"
    :style="{ width: '400px' }"
    :dismissableMask="true"
  >
    <div class="rename-file-dialog">
      <div class="field mb-4">
        <label for="currentName" class="block mb-2">Текущее имя</label>
        <InputText
          id="currentName"
          :value="currentName"
          class="w-full"
          disabled
        />
      </div>
      
      <div class="field mb-4">
        <label for="newName" class="block mb-2">Новое имя</label>
        <InputText
          id="newName"
          v-model="newName"
          class="w-full"
          placeholder="Введите новое имя файла"
          @keydown.enter="renameFile"
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
        label="Переименовать"
        icon="pi pi-check"
        @click="renameFile"
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
const newName = ref('');
const error = ref('');

// Текущее имя файла
const currentName = computed(() => {
  return state.selectedFile ? state.selectedFile.name : '';
});

// Видимость диалога
const visible = computed({
  get: () => state.dialogs.rename,
  set: (value) => {
    if (!value) {
      actions.closeDialog('rename');
    }
  }
});

// Валидация нового имени файла
const isValid = computed(() => {
  return newName.value.trim().length > 0 && 
         newName.value.trim() !== currentName.value &&
         !error.value;
});

// Сброс формы при открытии диалога
watch(() => state.dialogs.rename, (newValue) => {
  if (newValue && state.selectedFile) {
    // Устанавливаем текущее имя файла в качестве начального значения
    newName.value = state.selectedFile.name;
    error.value = '';
  }
});

// Валидация нового имени файла
watch(newName, (newValue) => {
  error.value = '';
  
  if (!newValue.trim()) {
    error.value = 'Имя файла не может быть пустым';
    return;
  }
  
  // Проверка на недопустимые символы
  const invalidChars = /[<>:"\/\\|?*]/;
  if (invalidChars.test(newValue)) {
    error.value = 'Имя файла содержит недопустимые символы: < > : " / \\ | ? *';
    return;
  }
  
  // Проверка, что имя файла изменилось
  if (newValue.trim() === currentName.value) {
    error.value = 'Новое имя должно отличаться от текущего';
    return;
  }
});

// Переименование файла
const renameFile = async () => {
  if (!isValid.value) return;
  
  try {
    await actions.renameFile(newName.value.trim());
    closeDialog();
  } catch (err) {
    error.value = 'Ошибка при переименовании файла: ' + err.message;
  }
};

// Закрытие диалога
const closeDialog = () => {
  actions.closeDialog('rename');
};
</script>

<style scoped>
.rename-file-dialog {
  padding: 1rem 0;
}
</style>
