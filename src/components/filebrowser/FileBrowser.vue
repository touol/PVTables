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
            icon="pi pi-camera"
            label="Сфотографировать"
            class="mr-2 p-button-info"
            @click="photoCaptureOpen = true"
          />
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
          <Button
            v-if="selectionMode && boundPath"
            icon="pi pi-eraser"
            label="Очистить привязку"
            class="mr-2 p-button-warning"
            @click="clearBindingConfirmOpen = true"
          />
        </div>
      </div>
    </div>

    <!-- Подтверждение очистки привязки -->
    <Dialog
      v-model:visible="clearBindingConfirmOpen"
      header="Очистить привязку файла?"
      :modal="true"
      :dismissableMask="true"
      :style="{ width: '400px' }"
    >
      <p class="mb-4">
        Поле в записи будет очищено. <strong>Физически файл не удаляется</strong>,
        остаётся на сервере.
      </p>
      <template #footer>
        <Button
          label="Отмена"
          icon="pi pi-times"
          class="p-button-text"
          @click="clearBindingConfirmOpen = false"
        />
        <Button
          label="Очистить"
          icon="pi pi-eraser"
          class="p-button-warning"
          @click="confirmClearBinding"
        />
      </template>
    </Dialog>
    
    <!-- Основной контент -->
    <div class="content-wrapper flex flex-1 overflow-hidden">
      <!-- Левая панель: дерево директорий -->
      <div class="directory-tree-panel w-1/4 border-r">
        <DirectoryTree :mediaSource="mediaSource" :initialPath="initialPath" />
      </div>
      
      <!-- Центральная панель: список файлов -->
      <div
        class="file-view-panel flex-1"
        :class="{
          'has-bottom-sheet': isMobile && state.selectedFile,
          'has-bottom-sheet-expanded': isMobile && state.selectedFile && detailsExpanded,
        }"
      >
        <FileView />
      </div>
      
      <!-- Правая панель: детали файла -->
      <div
        class="file-details-panel w-1/4 border-l"
        :class="{
          'file-details-bottom': isMobile && state.selectedFile,
          'file-details-expanded': detailsExpanded,
        }"
      >
        <!-- Mobile-only: крестик закрытия + кнопка «Выбрать этот файл» + разворот деталей -->
        <template v-if="isMobile">
          <button
            v-if="state.selectedFile"
            class="file-details-close"
            type="button"
            @click="closeDetails"
            aria-label="Закрыть"
          >
            <i class="pi pi-times"></i>
          </button>
          <div
            v-if="state.selectedFile && selectionMode && !state.selectedFile.is_dir"
            class="file-details-select-bar"
          >
            <Button
              icon="pi pi-check"
              label="Выбрать этот файл"
              class="p-button-success"
              @click="selectCurrentFile"
            />
            <button
              class="file-details-expand-btn"
              type="button"
              @click="detailsExpanded = !detailsExpanded"
            >
              <i :class="detailsExpanded ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"></i>
              {{ detailsExpanded ? 'Скрыть детали' : 'Детали' }}
            </button>
          </div>
        </template>

        <FileDetails v-show="!isMobile || detailsExpanded" />
      </div>
    </div>
    
    <!-- Диалоги -->
    <FileUploadDialog />
    <CreateDirectoryDialog />
    <RenameFileDialog />
    <RemoveFileDialog />

    <!-- Съёмка документа через камеру (OpenCV + jscanify, лениво) -->
    <PhotoCapture
      v-if="photoCaptureOpen"
      v-model:visible="photoCaptureOpen"
      :mediaSource="mediaSource"
      :uploadPath="currentPath || '/'"
      @fileUploaded="onPhotoUploaded"
    />
  </div>
  <Toast/>
</template>

<script setup>
import { computed, provide, ref, watch, onMounted } from 'vue';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import Dialog from 'primevue/dialog';
import DirectoryTree from './DirectoryTree.vue';
import FileView from './FileView.vue';
import FileDetails from './FileDetails.vue';
import FileUploadDialog from './dialogs/FileUploadDialog.vue';
import CreateDirectoryDialog from './dialogs/CreateDirectoryDialog.vue';
import RenameFileDialog from './dialogs/RenameFileDialog.vue';
import RemoveFileDialog from './dialogs/RemoveFileDialog.vue';
import PhotoCapture from './PhotoCapture.vue';
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
  },
  // Текущий привязанный путь (для кнопки «Очистить привязку»). Пусто — кнопка скрыта.
  boundPath: {
    type: String,
    default: ''
  }
});

// Эмиты
const emit = defineEmits(['fileSelected', 'fileDeleted', 'clearBinding']);

// Подтверждение очистки привязки
const clearBindingConfirmOpen = ref(false);
const confirmClearBinding = () => {
  clearBindingConfirmOpen.value = false;
  emit('clearBinding');
};

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

// Диалог съёмки документа
const photoCaptureOpen = ref(false);

// Мобильный режим: bottom sheet деталей компактный, разворачивается по кнопке
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < 768);
const detailsExpanded = ref(false);
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < 768;
  });
}
const closeDetails = () => {
  actions.selectFile(null);
  detailsExpanded.value = false;
};

// При открытии: найти и выделить файл, на который указывает boundPath.
// Иначе остаётся последний выбранный файл от прошлой сессии, что путает.
const autoSelectBound = () => {
  const bound = props.boundPath || '';
  if (!bound) {
    // Никакой привязки — очищаем выбор
    actions.selectFile(null);
    return;
  }
  const name = (bound.split('/').pop() || '').split('?')[0];
  const match = state.files.find(f => !f.is_dir && f.name === name);
  if (match) actions.selectFile(match);
  else actions.selectFile(null);
};

onMounted(() => {
  // Первый прогон после того как DirectoryTree подтянет список.
  // files может быть ещё пуст — подхватим через watch.
  autoSelectBound();
});

watch(() => state.files, () => autoSelectBound(), { immediate: false });
watch(() => props.boundPath, () => autoSelectBound());

const onPhotoUploaded = async ({ url, name }) => {
  photoCaptureOpen.value = false;
  // Перечитываем список файлов текущей директории, чтобы новый файл появился
  await fileStore.actions.loadFiles(state.currentDirectory, props.mediaSource);
  // В режиме выбора сразу эмитим результат
  if (props.selectionMode && url) {
    emit('fileSelected', url);
  }
};

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
    const filePath = state.selectedFile.url || (state.currentDirectory + state.selectedFile.name);
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

/* ── Мобильный вид (≤ 768px) ── */
@media (max-width: 768px) {
  .file-browser .toolbar {
    padding: 0.5rem;
  }
  .file-browser .toolbar > .flex {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  .file-browser .toolbar h2 {
    font-size: 1rem;
    margin: 0;
  }
  .file-browser .breadcrumb {
    max-width: 100%;
    font-size: 0.85rem;
  }
  .file-browser .actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.4rem;
    width: 100%;
  }
  .file-browser .actions .p-button {
    width: 100%;
    margin-right: 0 !important;
    justify-content: center;
  }

  /* Содержимое: прячем дерево, список файлов во всю ширину */
  .file-browser .content-wrapper {
    flex-direction: column;
    height: auto;
    flex: 1;
    min-height: 0;
  }
  .file-browser .directory-tree-panel {
    display: none;
  }
  .file-browser .file-view-panel {
    width: 100%;
    border: none;
    flex: 1;
    min-height: 0;
  }
  /* Когда снизу всплыла панель деталей — прижимаем низ файл-вью к верху
     bottom-sheet, чтобы содержимое не заезжало под неё, а пустого места
     не было, если файлов мало */
  .file-browser .file-view-panel.has-bottom-sheet {
    margin-bottom: 22vh;
  }
  .file-browser .file-view-panel.has-bottom-sheet-expanded {
    margin-bottom: 70vh;
  }

  /* Панель деталей по умолчанию скрыта; при выборе файла —
     всплывает снизу как компактный bottom-sheet */
  .file-browser .file-details-panel {
    display: none;
  }
  .file-browser .file-details-panel.file-details-bottom {
    display: block;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 22vh;        /* компактно, оставляем список файлов видимым */
    overflow-y: auto;
    background: #fff;
    border: none;
    border-top: 1px solid #e5e7eb;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    padding-bottom: env(safe-area-inset-bottom, 0);
    transition: max-height 0.25s ease;
  }
  .file-browser .file-details-panel.file-details-bottom.file-details-expanded {
    max-height: 70vh;
  }
  .file-browser .file-details-expand-btn {
    margin-top: 0.4rem;
    width: 100%;
    padding: 0.35rem;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
  }
  .file-browser .file-details-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 2;
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    border: 1px solid #e5e7eb;
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* Кнопка «Выбрать файл» поверх всего, закреплена сверху bottom-sheet */
  .file-browser .file-details-select-bar {
    position: sticky;
    top: 0;
    z-index: 3;
    background: #fff;
    padding: 0.5rem 3rem 0.5rem 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }
  .file-browser .file-details-select-bar .p-button {
    width: 100%;
    justify-content: center;
  }
}

/* На десктопе спец. кнопки закрытия не нужно */
.file-browser .file-details-close { display: none; }
@media (max-width: 768px) {
  .file-browser .file-details-panel.file-details-bottom .file-details-close {
    display: flex;
  }
}
</style>
