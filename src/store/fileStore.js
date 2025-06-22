import { ref, reactive, computed } from 'vue';
import FileService from '../services/FileService';
import { useNotifications } from '../components/useNotifications';
const { notify } = useNotifications()
// Создаем экземпляр сервиса для работы с файлами
const fileService = new FileService();

// Состояние хранилища
const state = reactive({
  // Текущая директория
  currentDirectory: '/',
  // Список файлов в текущей директории
  files: [],
  // Выбранный файл
  selectedFile: null,
  // Режим отображения (grid/list)
  viewMode: 'grid',
  // Поле сортировки
  sortField: 'name',
  // Порядок сортировки (1: по возрастанию, -1: по убыванию)
  sortOrder: 1,
  // Текущий фильтр
  filter: '',
  // Текущий источник медиа
  mediaSource: 1,
  // Загрузка данных
  loading: false,
  // Ошибка
  error: null,
  // Флаг необходимости обновления дерева директорий
  directoryTreeNeedsUpdate: 0,
  // Диалоги
  dialogs: {
    upload: false,
    createDirectory: false,
    rename: false,
    remove: false
  }
});

// Отсортированные и отфильтрованные файлы
const filteredFiles = computed(() => {
  // Фильтрация
  let result = state.files;
  if (state.filter) {
    const filterLower = state.filter.toLowerCase();
    result = result.filter(file => 
      file.name.toLowerCase().includes(filterLower)
    );
  }
  
  // Сортировка
  result = [...result].sort((a, b) => {
    let valA, valB;
    
    // Определяем значения для сортировки в зависимости от поля
    switch (state.sortField) {
      case 'name':
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        break;
      case 'size':
        valA = a.size || 0;
        valB = b.size || 0;
        break;
      case 'lastmod':
        valA = new Date(a.lastmod || 0).getTime();
        valB = new Date(b.lastmod || 0).getTime();
        break;
      default:
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
    }
    
    // Сортировка с учетом порядка
    if (valA < valB) return -1 * state.sortOrder;
    if (valA > valB) return 1 * state.sortOrder;
    return 0;
  });
  
  return result;
});

// Действия
const actions = {
  /**
   * Загрузка списка файлов
   * @param {string} directory - Директория для загрузки файлов
   * @param {number} source - ID источника медиа
   */
  async loadFiles(directory = state.currentDirectory, source = state.mediaSource) {
    try {
      state.loading = true;
      state.error = null;
      state.currentDirectory = directory;
      state.mediaSource = source;
      
      const result = await fileService.getFiles(directory, source);
      state.files = [...result.files, ...result.directories];
      
      // Сбрасываем выбранный файл, если его нет в новом списке
      if (state.selectedFile && !state.files.find(f => f.name === state.selectedFile.name)) {
        state.selectedFile = null;
      }
    } catch (error) {
      state.error = 'Ошибка при загрузке файлов: ' + error.message;
      notify('error', { detail: error.message });
    } finally {
      state.loading = false;
    }
  },
  
  /**
   * Выбор файла
   * @param {Object} file - Файл для выбора
   */
  selectFile(file) {
    state.selectedFile = file;
  },
  
  /**
   * Изменение режима отображения
   * @param {string} mode - Режим отображения (grid/list)
   */
  setViewMode(mode) {
    state.viewMode = mode;
  },
  
  /**
   * Изменение поля сортировки
   * @param {string} field - Поле сортировки
   */
  setSortField(field) {
    // Если выбрано то же поле, меняем порядок сортировки
    if (state.sortField === field) {
      state.sortOrder *= -1;
    } else {
      state.sortField = field;
      state.sortOrder = 1;
    }
  },
  
  /**
   * Установка фильтра
   * @param {string} filter - Текст фильтра
   */
  setFilter(filter) {
    state.filter = filter;
  },
  
  /**
   * Загрузка файла
   * @param {File} file - Файл для загрузки
   */
  async uploadFile(file) {
    try {
      state.loading = true;
      state.error = null;
      
      const resp = await fileService.uploadFile(file, state.currentDirectory, state.mediaSource);
      
      // Перезагружаем список файлов
      await actions.loadFiles();
      
      // Закрываем диалог загрузки
      state.dialogs.upload = false;
    } catch (error) {
      state.error = 'Ошибка при загрузке файла: ' + error.message;
      notify('error', { detail: error.message });
    } finally {
      state.loading = false;
    }
  },
  
  /**
   * Создание директории
   * @param {string} name - Имя директории
   */
  async createDirectory(name) {
    try {
      state.loading = true;
      state.error = null;
      
      const resp = await fileService.createDirectory(state.currentDirectory, name, state.mediaSource);
      if(resp.success !== 1) return;
      
      // Перезагружаем список файлов
      await actions.loadFiles();
      
      // Сигнализируем о необходимости обновления дерева директорий
      actions.triggerDirectoryTreeUpdate();
      
      // Закрываем диалог создания директории
      state.dialogs.createDirectory = false;
    } catch (error) {
      state.error = 'Ошибка при создании директории: ' + error.message;
      notify('error', { detail: error.message });
    } finally {
      state.loading = false;
    }
  },
  
  /**
   * Переименование файла
   * @param {string} newName - Новое имя файла
   */
  async renameFile(newName) {
    if (!state.selectedFile) return;
    
    try {
      state.loading = true;
      state.error = null;
      
      const path = state.currentDirectory + state.selectedFile.name;
      const resp = await fileService.rename(path, newName, state.mediaSource);
      if(resp.success !== 1) return;
      
      // Перезагружаем список файлов
      await actions.loadFiles();
      
      // Закрываем диалог переименования
      state.dialogs.rename = false;
    } catch (error) {
      state.error = 'Ошибка при переименовании файла: ' + error.message;
      notify('error', { detail: error.message });
    } finally {
      state.loading = false;
    }
  },
  
  /**
   * Удаление файла или директории
   */
  async removeFile() {
    if (!state.selectedFile) return;
    
    try {
      state.loading = true;
      state.error = null;
      
      // Формируем путь в зависимости от типа элемента
      let path = state.selectedFile.name;
      
      // Для директорий добавляем слеш в конце, если его нет
      if (state.selectedFile.is_dir && !path.endsWith('/')) {
        path = path + '/';
      }
      
      const resp = await fileService.remove(path, state.mediaSource);
      if(resp.success !== 1) {
        notify('error', { detail: resp.message || 'Ошибка при удалении' });
        return;
      }
      
      // Перезагружаем список файлов
      await actions.loadFiles();
      
      // Сигнализируем о необходимости обновления дерева директорий
      actions.triggerDirectoryTreeUpdate();
      
      // Сбрасываем выбранный файл
      state.selectedFile = null;
      
      // Закрываем диалог удаления
      state.dialogs.remove = false;
    } catch (error) {
      state.error = 'Ошибка при удалении: ' + error.message;
      notify('error', { detail: error.message });
    } finally {
      state.loading = false;
    }
  },
  
  /**
   * Скачивание файла
   */
  async downloadFile() {
    if (!state.selectedFile) return;
    
    try {
      state.loading = true;
      state.error = null;
      
      const filePath = state.currentDirectory + state.selectedFile.name;
      const resp = await fileService.downloadFile(filePath, state.mediaSource);
      if(resp.success !== 1) return;
      
      const blob = resp.data;
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = state.selectedFile.name;
      document.body.appendChild(a);
      a.click();
      
      // Очищаем ресурсы
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      state.error = 'Ошибка при скачивании файла: ' + error.message;
      notify('error', { detail: error.message });
    } finally {
      state.loading = false;
    }
  },
  
  /**
   * Открытие диалога
   * @param {string} dialog - Имя диалога
   */
  openDialog(dialog) {
    state.dialogs[dialog] = true;
  },
  
  /**
   * Закрытие диалога
   * @param {string} dialog - Имя диалога
   */
  closeDialog(dialog) {
    state.dialogs[dialog] = false;
  },
  
  /**
   * Сигнализирует о необходимости обновления дерева директорий
   */
  triggerDirectoryTreeUpdate() {
    state.directoryTreeNeedsUpdate += 1;
  }
};

// Экспортируем хранилище
export default {
  state,
  filteredFiles,
  actions
};
