<template>
  <div class="modal-overlay" @click="closeDialog">
    <div class="modal-dialog" @click.stop>
      <div class="modal-header">
        <h4 class="modal-title">Загрузка файлов</h4>
        <button @click="closeDialog" class="btn-close">
          <span class="icon">✕</span>
        </button>
      </div>

      <div class="modal-body">
        <!-- Зона перетаскивания -->
        <div 
          class="upload-zone"
          :class="{ 
            'drag-over': isDragOver,
            'uploading': isUploading
          }"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragenter="handleDragEnter"
          @dragleave="handleDragLeave"
          @click="triggerFileInput"
        >
          <div v-if="!isUploading" class="upload-zone-content">
            <span class="upload-icon">☁⬆</span>
            <p class="upload-text">
              Перетащите файлы сюда или <span class="upload-link">нажмите для выбора</span>
            </p>
            <p class="upload-hint">
              Поддерживаемые форматы: {{ allowedExtensions.join(', ').toUpperCase() }}
            </p>
            <p class="upload-hint">
              Максимальный размер файла: {{ formatFileSize(maxFileSize) }}
            </p>
          </div>
          
          <div v-else class="upload-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill"
                :style="{ width: uploadProgress + '%' }"
              ></div>
            </div>
            <p class="progress-text">
              Загружено {{ uploadedCount }} из {{ totalFiles }} файлов ({{ uploadProgress }}%)
            </p>
          </div>
        </div>

        <!-- Скрытый input для выбора файлов -->
        <input
          ref="fileInput"
          type="file"
          multiple
          :accept="acceptedTypes"
          @change="handleFileSelect"
          style="display: none"
        />

        <!-- Список выбранных файлов -->
        <div v-if="selectedFiles.length > 0" class="selected-files">
          <h5>Выбранные файлы:</h5>
          <div class="file-list">
            <div 
              v-for="(file, index) in selectedFiles"
              :key="index"
              class="file-item"
              :class="{ 
                'file-error': file.error,
                'file-success': file.uploaded,
                'file-uploading': file.uploading
              }"
            >
              <div class="file-info">
                <div class="file-icon">
                  <span v-if="file.error" class="text-danger">⚠</span>
                  <span v-else-if="file.uploaded" class="text-success">✓</span>
                  <span v-else-if="file.uploading" class="spinner">⟳</span>
                  <span v-else>{{ getFileIcon(file.type) }}</span>
                </div>
                <div class="file-details">
                  <div class="file-name">{{ file.name }}</div>
                  <div class="file-meta">
                    {{ formatFileSize(file.size) }} • {{ file.type.toUpperCase() }}
                  </div>
                  <div v-if="file.error" class="file-error-message">
                    {{ file.error }}
                  </div>
                </div>
              </div>
              <div class="file-actions">
                <button 
                  v-if="!file.uploading && !file.uploaded"
                  @click="removeFile(index)"
                  class="btn btn-sm btn-outline"
                  title="Удалить из списка"
                >
                  <span class="icon">✕</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Дополнительные параметры -->
        <div class="upload-options">
          <div class="form-group">
            <label for="description">Описание:</label>
            <textarea
              id="description"
              v-model="description"
              class="form-control"
              rows="2"
              placeholder="Общее описание для всех загружаемых файлов..."
            ></textarea>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button 
          @click="closeDialog"
          class="btn btn-secondary"
          :disabled="isUploading"
        >
          Отмена
        </button>
        <button 
          @click="uploadFiles"
          class="btn btn-primary"
          :disabled="selectedFiles.length === 0 || isUploading"
        >
          <span v-if="isUploading" class="spinner">⟳</span>
          <span v-else class="icon">⬆</span>
          {{ isUploading ? 'Загрузка...' : 'Загрузить файлы' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileUploadDialog',
  props: {
    parentId: {
      type: [Number, String],
      default: 0
    },
    parentClass: {
      type: String,
      default: 'modResource'
    },
    listName: {
      type: String,
      default: 'default'
    },
    allowedExtensions: {
      type: Array,
      default: () => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar']
    },
    maxFileSize: {
      type: Number,
      default: 10485760 // 10MB
    },
    apiEndpoint: {
      type: String,
      default: '/api/file-gallery'
    }
  },
  data() {
    return {
      selectedFiles: [],
      isDragOver: false,
      isUploading: false,
      uploadProgress: 0,
      uploadedCount: 0,
      totalFiles: 0,
      description: ''
    }
  },
  computed: {
    acceptedTypes() {
      return this.allowedExtensions.map(ext => `.${ext}`).join(',')
    }
  },
  methods: {
    closeDialog() {
      if (!this.isUploading) {
        this.$emit('close')
      }
    },

    triggerFileInput() {
      if (!this.isUploading) {
        this.$refs.fileInput.click()
      }
    },

    handleFileSelect(event) {
      const files = Array.from(event.target.files)
      this.processFiles(files)
      // Очищаем input для возможности повторного выбора тех же файлов
      event.target.value = ''
    },

    handleDrop(event) {
      event.preventDefault()
      this.isDragOver = false
      
      if (this.isUploading) return

      const files = Array.from(event.dataTransfer.files)
      this.processFiles(files)
    },

    handleDragOver(event) {
      event.preventDefault()
    },

    handleDragEnter(event) {
      event.preventDefault()
      this.isDragOver = true
    },

    handleDragLeave(event) {
      event.preventDefault()
      // Проверяем, что мы действительно покинули зону
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.isDragOver = false
      }
    },

    processFiles(files) {
      for (const file of files) {
        const fileObj = {
          file: file,
          name: file.name,
          size: file.size,
          type: this.getFileExtension(file.name),
          error: null,
          uploading: false,
          uploaded: false
        }

        // Валидация файла
        const validation = this.validateFile(file)
        if (!validation.valid) {
          fileObj.error = validation.error
        }

        this.selectedFiles.push(fileObj)
      }
    },

    validateFile(file) {
      // Проверка размера
      if (file.size > this.maxFileSize) {
        return {
          valid: false,
          error: `Файл слишком большой. Максимальный размер: ${this.formatFileSize(this.maxFileSize)}`
        }
      }

      // Проверка расширения
      const extension = this.getFileExtension(file.name)
      if (!this.allowedExtensions.includes(extension.toLowerCase())) {
        return {
          valid: false,
          error: `Недопустимое расширение файла: ${extension}`
        }
      }

      return { valid: true }
    },

    getFileExtension(filename) {
      return filename.split('.').pop().toLowerCase()
    },

    removeFile(index) {
      this.selectedFiles.splice(index, 1)
    },

    async uploadFiles() {
      if (this.selectedFiles.length === 0 || this.isUploading) return

      this.isUploading = true
      this.uploadProgress = 0
      this.uploadedCount = 0
      this.totalFiles = this.selectedFiles.filter(f => !f.error).length

      const uploadedFiles = []

      for (let i = 0; i < this.selectedFiles.length; i++) {
        const fileObj = this.selectedFiles[i]
        
        if (fileObj.error) continue

        fileObj.uploading = true

        try {
          const formData = new FormData()
          formData.append('files[]', fileObj.file)
          formData.append('action', 'upload')
          formData.append('parent', this.parentId)
          formData.append('class', this.parentClass)
          formData.append('list', this.listName)
          if (this.description) {
            formData.append('description', this.description)
          }

          const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            body: formData
          })

          const data = await response.json()

          if (data.success) {
            fileObj.uploaded = true
            fileObj.uploading = false
            this.uploadedCount++
            
            if (data.data.files && data.data.files.length > 0) {
              uploadedFiles.push(...data.data.files)
            }
          } else {
            fileObj.error = data.message
            fileObj.uploading = false
          }
        } catch (error) {
          fileObj.error = 'Ошибка загрузки: ' + error.message
          fileObj.uploading = false
        }

        // Обновляем прогресс
        this.uploadProgress = Math.round((this.uploadedCount / this.totalFiles) * 100)
      }

      this.isUploading = false

      // Если все файлы загружены успешно, закрываем диалог
      if (this.uploadedCount === this.totalFiles) {
        this.$emit('uploaded', uploadedFiles)
        setTimeout(() => {
          this.closeDialog()
        }, 1000)
      }
    },

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

    getFileIcon(type) {
      const iconMap = {
        pdf: '📄',
        doc: '📝',
        docx: '📝',
        xls: '📊',
        xlsx: '📊',
        txt: '📃',
        zip: '📦',
        rar: '📦',
        jpg: '🖼',
        jpeg: '🖼',
        png: '🖼',
        gif: '🖼',
        webp: '🖼'
      }
      return iconMap[type.toLowerCase()] || '📄'
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* Исправление конфликта с Bootstrap */
  pointer-events: auto !important;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e5e5e5;
  background: #f8f9fa;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #666;
  padding: 0.25rem;
  border-radius: 4px;
}

.btn-close:hover {
  background: #e9ecef;
  color: #000;
}

.modal-body {
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
}

.upload-zone {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 1rem;
}

.upload-zone:hover {
  border-color: #007bff;
  background: #f8f9ff;
}

.upload-zone.drag-over {
  border-color: #007bff;
  background: #f0f8ff;
}

.upload-zone.uploading {
  cursor: not-allowed;
  opacity: 0.7;
}

.upload-zone-content {
  pointer-events: none;
}

.upload-icon {
  font-size: 3rem;
  color: #007bff;
  margin-bottom: 1rem;
}

.upload-text {
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.upload-link {
  color: #007bff;
  text-decoration: underline;
}

.upload-hint {
  font-size: 0.875rem;
  color: #666;
  margin: 0.25rem 0;
}

.upload-progress {
  padding: 1rem 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: #666;
  margin: 0;
}

.selected-files {
  margin-bottom: 1rem;
}

.selected-files h5 {
  margin-bottom: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.file-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #e5e5e5;
  transition: background 0.2s;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item:hover {
  background: #f8f9fa;
}

.file-item.file-error {
  background: #fff5f5;
  border-color: #fed7d7;
}

.file-item.file-success {
  background: #f0fff4;
  border-color: #c6f6d5;
}

.file-item.file-uploading {
  background: #f0f8ff;
  border-color: #bee5eb;
}

.file-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.file-icon {
  margin-right: 0.75rem;
  font-size: 1.25rem;
  width: 20px;
  text-align: center;
}

.file-details {
  flex: 1;
}

.file-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.file-meta {
  font-size: 0.875rem;
  color: #666;
}

.file-error-message {
  font-size: 0.875rem;
  color: #dc3545;
  margin-top: 0.25rem;
}

.file-actions {
  margin-left: 0.5rem;
}

.upload-options {
  margin-top: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  resize: vertical;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #e5e5e5;
  background: #f8f9fa;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.btn:hover {
  background: #f8f9fa;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  border-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
  border-color: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  border-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
  border-color: #545b62;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-outline {
  background: transparent;
  color: #666;
}

.btn-outline:hover {
  background: #f8f9fa;
}

.text-danger {
  color: #dc3545;
}

.text-success {
  color: #28a745;
}

/* Стили для иконок */
.icon {
  font-size: 1rem;
  line-height: 1;
  display: inline-block;
}

.spinner {
  display: inline-block;
  animation: spin 1s infinite linear;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.upload-icon {
  display: block;
  line-height: 1;
}

.file-icon {
  line-height: 1;
}
</style>
