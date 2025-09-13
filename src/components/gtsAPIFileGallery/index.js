// Экспорт всех компонентов галереи файлов
import FileGallery from './FileGallery.vue'
import FileUploadDialog from './FileUploadDialog.vue'
import FileEditDialog from './FileEditDialog.vue'
import FileViewDialog from './FileViewDialog.vue'

// Экспорт компонентов
export {
  FileGallery,
  FileUploadDialog,
  FileEditDialog,
  FileViewDialog
}

// Экспорт по умолчанию - основной компонент галереи
export default FileGallery

// Функция для установки компонентов в Vue приложение
export function install(app) {
  app.component('FileGallery', FileGallery)
  app.component('FileUploadDialog', FileUploadDialog)
  app.component('FileEditDialog', FileEditDialog)
  app.component('FileViewDialog', FileViewDialog)
}

// Конфигурация по умолчанию
export const defaultConfig = {
  apiEndpoint: '/api/file-gallery',
  allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'],
  maxFileSize: 10485760, // 10MB
  pageSize: 20,
  allowUpload: true,
  allowEdit: true,
  allowDelete: true,
  showFilters: true
}

// Утилиты для работы с файлами
export const fileUtils = {
  /**
   * Форматирование размера файла
   */
  formatFileSize(bytes, precision = 2) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(precision)} ${units[unitIndex]}`
  },

  /**
   * Получение иконки для типа файла
   */
  getFileIcon(type) {
    const iconMap = {
      pdf: 'fas fa-file-pdf',
      doc: 'fas fa-file-word',
      docx: 'fas fa-file-word',
      xls: 'fas fa-file-excel',
      xlsx: 'fas fa-file-excel',
      txt: 'fas fa-file-alt',
      zip: 'fas fa-file-archive',
      rar: 'fas fa-file-archive',
      jpg: 'fas fa-file-image',
      jpeg: 'fas fa-file-image',
      png: 'fas fa-file-image',
      gif: 'fas fa-file-image',
      webp: 'fas fa-file-image'
    }
    return iconMap[type.toLowerCase()] || 'fas fa-file'
  },

  /**
   * Проверка, является ли файл изображением
   */
  isImage(type) {
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
    return imageTypes.includes(type.toLowerCase())
  },

  /**
   * Проверка, является ли файл текстовым
   */
  isTextFile(type) {
    const textTypes = ['txt', 'json', 'xml', 'html', 'css', 'js', 'php', 'py', 'md']
    return textTypes.includes(type.toLowerCase())
  },

  /**
   * Получение расширения файла
   */
  getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase()
  },

  /**
   * Валидация файла
   */
  validateFile(file, config = defaultConfig) {
    // Проверка размера
    if (file.size > config.maxFileSize) {
      return {
        valid: false,
        error: `Файл слишком большой. Максимальный размер: ${this.formatFileSize(config.maxFileSize)}`
      }
    }

    // Проверка расширения
    const extension = this.getFileExtension(file.name)
    if (!config.allowedExtensions.includes(extension.toLowerCase())) {
      return {
        valid: false,
        error: `Недопустимое расширение файла: ${extension}`
      }
    }

    return { valid: true }
  }
}

// API клиент для работы с галереей файлов
export class FileGalleryAPI {
  constructor(endpoint = defaultConfig.apiEndpoint) {
    this.endpoint = endpoint
  }

  /**
   * Получение списка файлов
   */
  async getFiles(params = {}) {
    const queryParams = new URLSearchParams({
      action: 'list',
      ...params
    })

    const response = await fetch(`${this.endpoint}?${queryParams}`)
    return await response.json()
  }

  /**
   * Получение конкретного файла
   */
  async getFile(id) {
    const response = await fetch(`${this.endpoint}/${id}?action=get`)
    return await response.json()
  }

  /**
   * Загрузка файлов
   */
  async uploadFiles(files, params = {}) {
    const formData = new FormData()
    
    // Добавляем файлы
    if (Array.isArray(files)) {
      files.forEach(file => {
        formData.append('files[]', file)
      })
    } else {
      formData.append('files[]', files)
    }

    // Добавляем параметры
    formData.append('action', 'upload')
    Object.keys(params).forEach(key => {
      formData.append(key, params[key])
    })

    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: formData
    })

    return await response.json()
  }

  /**
   * Обновление файла
   */
  async updateFile(id, data) {
    const response = await fetch(`${this.endpoint}/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'update',
        ...data
      })
    })

    return await response.json()
  }

  /**
   * Удаление файла
   */
  async deleteFile(id) {
    const response = await fetch(`${this.endpoint}/${id}`, {
      method: 'DELETE'
    })

    return await response.json()
  }

  /**
   * Привязка файла к объекту
   */
  async attachFile(fileId, parentId, parentClass, listName = 'default') {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'attach',
        file_id: fileId,
        parent: parentId,
        class: parentClass,
        list: listName
      })
    })

    return await response.json()
  }

  /**
   * Отвязка файла от объекта
   */
  async detachFile(fileId) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'detach',
        file_id: fileId
      })
    })

    return await response.json()
  }

  /**
   * Генерация миниатюр
   */
  async generateThumbnails(id) {
    const response = await fetch(`${this.endpoint}/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'generate_thumbnails'
      })
    })

    return await response.json()
  }

  /**
   * Получение URL для скачивания файла
   */
  getDownloadUrl(id) {
    return `${this.endpoint}/${id}?action=download`
  }

  /**
   * Получение содержимого текстового файла
   */
  async getFileContent(id) {
    const response = await fetch(`${this.endpoint}/${id}?action=content`)
    return await response.json()
  }
}
