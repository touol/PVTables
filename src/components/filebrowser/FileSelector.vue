<template>
  <div class="file-selector">
    <InputGroup>
      <InputText 
        v-model="localValue" 
        :placeholder="placeholder" 
        :disabled="disabled"
        class="w-full"
      />
      <Button 
        icon="pi pi-folder-open" 
        @click="openFileBrowser"
        :disabled="disabled"
      />
    </InputGroup>
    
    <!-- Модальное окно с файловым браузером -->
    <Dialog 
      v-model:visible="showFileBrowser" 
      :header="'Выбор файла'" 
      :modal="true" 
      :style="{ width: '90vw', height: '80vh' }"
      :dismissableMask="true"
    >
      <div class="file-browser-container" style="height: 100%;">
        <FileBrowser 
          :selectionMode="true" 
          :mediaSource="mediaSource"
          :initialPath="localValue"
          @fileSelected="onFileSelected"
        />
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import InputText from 'primevue/inputtext';
import InputGroup from 'primevue/inputgroup';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import FileBrowser from './FileBrowser.vue';

// Определение props
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Выберите файл'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  mediaSource: {
    type: Number,
    default: 1
  }
});

// Определение emit
const emit = defineEmits(['update:modelValue', 'fileSelected']);

// Локальное состояние
const localValue = ref(props.modelValue);
const showFileBrowser = ref(false);

// Отслеживаем изменения modelValue
watch(() => props.modelValue, (newValue) => {
  localValue.value = newValue;
});

// Отслеживаем изменения localValue
watch(localValue, (newValue) => {
  emit('update:modelValue', newValue);
});

// Открытие файлового браузера
const openFileBrowser = () => {
  showFileBrowser.value = true;
};

// Обработчик выбора файла
const onFileSelected = (filePath) => {
  localValue.value = filePath;
  emit('fileSelected', filePath);
  showFileBrowser.value = false;
};
</script>

<style scoped>
.file-selector {
  width: 100%;
}

.file-browser-container {
  overflow: hidden;
}
</style>
