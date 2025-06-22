import axios from 'axios';
import { useNotifications } from '../components/useNotifications';
const { notify } = useNotifications();

/**
 * Сервис для работы с файлами и директориями
 */
export default class FileService {
  constructor() {
    // Создаем экземпляр axios с настройками для MODX
    this.api = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      withCredentials: true // Для отправки куки с запросом
    });
    
    // Настройка ответа
    this.api.interceptors.response.use(
      response => {
        if (response.data && typeof response.data === 'object') {
          return response;
        }
        return response;
      },
      error => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Получение списка файлов в директории
   * @param {string} path - Путь к директории
   * @param {number} source - ID источника медиа
   * @returns {Promise<Object>} - Объект с файлами и директориями
   */
  async getFiles(path, source = 1) {
    try {
      const response = await this.api.get('/files', {
        params: { path, source }
      });
      
      const result = {
        success: response.data.success,
        message: response.data.message,
        files: response.data.data.files || [],
        directories: response.data.data.directories || []
      };
      
      if (result.success !== 1) {
        notify('error', { detail: 'Ошибка при загрузке файлов: ' + result.message });
      }
      
      return result;
    } catch (error) {
      console.error('Ошибка при получении списка файлов:', error);
      notify('error', { detail: error.message });
      return {
        success: 0,
        message: error.message,
        files: [],
        directories: []
      };
    }
  }
  
  /**
   * Получение списка директорий
   * @param {string} path - Путь к директории
   * @param {number} source - ID источника медиа
   * @returns {Promise<Array>} - Список директорий
   */
  async getDirectories(path, source = 1) {
    try {
      const response = await this.api.get('/files', {
        params: { path, source }
      });
      
      const result = {
        success: response.data.success,
        message: response.data.message,
        directories: response.data.data.directories || []
      };
      
      if (result.success !== 1) {
        notify('error', { detail: 'Ошибка при загрузке директорий: ' + result.message });
      }
      
      return result;
    } catch (error) {
      console.error('Ошибка при получении списка директорий:', error);
      notify('error', { detail: error.message });
      return {
        success: 0,
        message: error.message,
        directories: []
      };
    }
  }

  /**
   * Загрузка файла
   * @param {File} file - Файл для загрузки
   * @param {string} path - Директория для загрузки
   * @param {number} source - ID источника медиа
   * @returns {Promise<Object>} - Результат загрузки
   */
  async uploadFile(file, path, source = 1) {
    try {
      const formData = new FormData();
      formData.append('action', 'upload');
      formData.append('file', file);
      formData.append('path', path);
      formData.append('source', source);

      const response = await this.api.post('/files', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const result = response.data;
      
      if (result.success !== 1) {
        notify('error', { detail: 'Ошибка при загрузке файла: ' + result.message });
      }
      
      return result;
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
      notify('error', { detail: error.message });
      return {
        success: 0,
        message: error.message
      };
    }
  }

  /**
   * Создание директории
   * @param {string} path - Путь к родительской директории
   * @param {string} name - Имя новой директории
   * @param {number} source - ID источника медиа
   * @returns {Promise<Object>} - Результат создания директории
   */
  async createDirectory(path, name, source = 1) {
    try {
      const response = await this.api.post('/files', {
        action: 'directory',
        path,
        name,
        source
      });
      
      const result = response.data;
      
      if (result.success !== 1) {
        notify('error', { detail: 'Ошибка при создании директории: ' + result.message });
      }
      
      return result;
    } catch (error) {
      console.error('Ошибка при создании директории:', error);
      notify('error', { detail: error.message });
      return {
        success: 0,
        message: error.message
      };
    }
  }

  /**
   * Переименование файла или директории
   * @param {string} path - Путь к файлу или директории
   * @param {string} newName - Новое имя
   * @param {number} source - ID источника медиа
   * @returns {Promise<Object>} - Результат переименования
   */
  async rename(path, newName, source = 1) {
    try {
      const response = await this.api.post('/files', {
        action: 'rename',
        path,
        newName,
        source
      });
      
      const result = response.data;
      
      if (result.success !== 1) {
        notify('error', { detail: 'Ошибка при переименовании файла: ' + result.message });
      }
      
      return result;
    } catch (error) {
      console.error('Ошибка при переименовании:', error);
      notify('error', { detail: error.message });
      return {
        success: 0,
        message: error.message
      };
    }
  }

  /**
   * Удаление файла или директории
   * @param {string} path - Путь к файлу или директории
   * @param {number} source - ID источника медиа
   * @returns {Promise<Object>} - Результат удаления
   */
  async remove(path, source = 1) {
    try {
      const response = await this.api.post('/files', {
        action: 'remove',
        path,
        source
      });
      
      const result = response.data;
      
      if (result.success !== 1) {
        notify('error', { detail: 'Ошибка при удалении файла: ' + result.message });
      }
      
      return result;
    } catch (error) {
      console.error('Ошибка при удалении:', error);
      notify('error', { detail: error.message });
      return {
        success: 0,
        message: error.message
      };
    }
  }

  /**
   * Скачивание файла
   * @param {string} path - Путь к файлу
   * @param {number} source - ID источника медиа
   * @returns {Promise<Blob>} - Содержимое файла
   */
  async downloadFile(path, source = 1) {
    try {
      const response = await this.api.get('/files', {
        params: {
          action: 'download',
          path,
          source
        },
        responseType: 'blob'
      });
      
      return {
        success: 1,
        data: response.data
      };
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error);
      notify('error', { detail: 'Ошибка при скачивании файла: ' + error.message });
      return {
        success: 0,
        message: error.message
      };
    }
  }

  /**
   * Форматирование размера файла
   * @param {number} size - Размер файла в байтах
   * @returns {string} - Отформатированный размер файла
   */
  formatFileSize(size) {
    if (size < 1024) {
      return size + ' байт';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(2) + ' КБ';
    } else if (size < 1024 * 1024 * 1024) {
      return (size / (1024 * 1024)).toFixed(2) + ' МБ';
    } else {
      return (size / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ';
    }
  }

  /**
   * Форматирование даты
   * @param {string|number} timestamp - Дата в формате unix timestamp или строки
   * @returns {string} - Отформатированная дата
   */
  formatDate(timestamp) {
    // Проверяем, является ли timestamp числом (unix timestamp)
    if (typeof timestamp === 'number' || !isNaN(Number(timestamp))) {
      // Умножаем на 1000, так как JavaScript работает с миллисекундами
      const date = new Date(Number(timestamp) * 1000);
      return date.toLocaleString('ru-RU');
    }
    
    // Если это не число, пробуем обработать как строку
    try {
      const dateObj = new Date(timestamp);
      return dateObj.toLocaleString('ru-RU');
    } catch (error) {
      console.error('Ошибка при форматировании даты:', error);
      return timestamp; // Возвращаем исходное значение в случае ошибки
    }
  }
}
