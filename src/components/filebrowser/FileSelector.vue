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
      :style="isMobile ? { width: '100vw', height: '100vh', maxHeight: '100vh', margin: 0 } : { width: '90vw', height: '80vh' }"
      :dismissableMask="false"
      :closeOnEscape="true"
    >
      <div class="file-browser-container" style="height: 100%;">
        <FileBrowser
          :selectionMode="true"
          :mediaSource="mediaSource"
          :initialPath="localValue"
          :boundPath="localValue"
          @fileSelected="onFileSelected"
          @fileDeleted="onFileDeleted"
          @clearBinding="clearBinding"
        />
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < 768);
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { isMobile.value = window.innerWidth < 768; });
}
import InputText from 'primevue/inputtext';
import InputGroup from 'primevue/inputgroup';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import FileBrowser from './FileBrowser.vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Выберите файл' },
  disabled: { type: Boolean, default: false },
  mediaSource: { type: Number, default: 1 },
});

const emit = defineEmits(['update:modelValue', 'fileSelected']);

const localValue = ref(props.modelValue);
const showFileBrowser = ref(false);

watch(() => props.modelValue, (v) => { localValue.value = v; });
watch(localValue, (v) => { emit('update:modelValue', v); });

const openFileBrowser = () => { showFileBrowser.value = true; };

const onFileSelected = (filePath) => {
  localValue.value = filePath;
  emit('fileSelected', filePath);
  showFileBrowser.value = false;
};

// Файл удалён в FileBrowser — если это был наш файл, сбрасываем привязку
const onFileDeleted = (deletedPath) => {
  if (!localValue.value) return;
  const same = localValue.value === deletedPath
    || localValue.value.endsWith('/' + (deletedPath.split('/').pop() || ''));
  if (same) {
    localValue.value = '';
    emit('fileSelected', '');
  }
};

// Кнопка «Очистить привязку» — просто обнуляет значение, не трогая файл
const clearBinding = () => {
  localValue.value = '';
  emit('fileSelected', '');
  showFileBrowser.value = false;
};
</script>

<style scoped>
.file-selector { width: 100%; }
.file-browser-container { overflow: hidden; }
</style>
