<template>
  <div class="modal-overlay" @click="closeDialog">
    <div class="modal-dialog" @click.stop>
      <div class="modal-header">
        <h4 class="modal-title">{{ file.name }}</h4>
        <div class="header-actions">
          <button 
            @click="downloadFile"
            class="btn btn-sm btn-outline-primary"
            title="Скачать файл"
          >
            <span class="icon">⬇</span>
          </button>
          <button @click="closeDialog" class="btn-close">
            <span class="icon">✕</span>
          </button>
        </div>
      </div>

      <div class="modal-body">
        <!-- Превью файла -->
        <div class="file-viewer">
          <!-- Изображения -->
          <div v-if="file.is_image" class="image-viewer">
            <div class="image-container">
              <img 
                :src="file.full_url"
                :alt="file.name"
                class="preview-image"
                @error="handleImageError"
                @load="handleImageLoad"
              />
              <div v-if="imageLoading" class="image-loading">
                <div class="spinner"></div>
                <p>Загрузка изображения...</p>
              </div>
            </div>
            
            <!-- Панель управления изображением -->
            <div class="image-controls" v-if="!imageLoading">
              <button 
                @click="zoomIn"
                class="btn btn-sm btn-outline"
                title="Увеличить"
                :disabled="zoomLevel >= maxZoom"
              >
                <span class="icon">🔍+</span>
              </button>
              <button 
                @click="zoomOut"
                class="btn btn-sm btn-outline"
                title="Уменьшить"
                :disabled="zoomLevel <= minZoom"
              >
                <span class="icon">🔍-</span>
              </button>
              <button 
                @click="resetZoom"
                class="btn btn-sm btn-outline"
                title="Сбросить масштаб"
              >
                <span class="icon">⤢</span>
              </button>
              <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
            </div>
          </div>

          <!-- PDF файлы -->
          <div v-else-if="file.type === 'pdf'" class="pdf-viewer">
            <iframe 
              :src="file.full_url"
              class="pdf-frame"
              title="PDF Viewer"
            ></iframe>
            <p class="viewer-hint">
              <span class="icon">ℹ</span>
              Если PDF не отображается, <a :href="file.full_url" target="_blank">откройте его в новой вкладке</a>
            </p>
          </div>

          <!-- Текстовые файлы -->
          <div v-else-if="isTextFile" class="text-viewer">
            <div v-if="textContent" class="text-content">
              <pre>{{ textContent }}</pre>
            </div>
            <div v-else-if="textLoading" class="text-loading">
              <div class="spinner"></div>
              <p>Загрузка содержимого файла...</p>
            </div>
            <div v-else class="text-error">
              <span class="icon">⚠</span>
              <p>Не удалось загрузить содержимое файла</p>
            </div>
          </div>

          <!-- Другие типы файлов -->
          <div v-else class="file-info-viewer">
            <div class="file-icon-large">
              <span>{{ getFileIcon(file.type) }}</span>
            </div>
            <h3>{{ file.name }}</h3>
            <p class="file-type">{{ file.type.toUpperCase() }} файл</p>
            <p class="file-description" v-if="file.description">
              {{ file.description }}
            </p>
            <button 
              @click="downloadFile"
              class="btn btn-primary btn-lg"
            >
              <span class="icon">⬇</span>
              Скачать файл
            </button>
          </div>
        </div>

        <!-- Информация о файле -->
        <div class="file-details">
          <h5>Информация о файле</h5>
          <div class="details-grid">
            <div class="detail-item">
              <strong>Размер:</strong>
              <span>{{ file.format_size }}</span>
            </div>
            <div class="detail-item">
              <strong>Тип:</strong>
              <span>{{ file.type.toUpperCase() }}</span>
            </div>
            <div class="detail-item">
              <strong>MIME:</strong>
              <span>{{ file.mime }}</span>
            </div>
            <div class="detail-item">
              <strong>Дата создания:</strong>
              <span>{{ file.format_createdon }}</span>
            </div>
            <div class="detail-item" v-if="file.resource_pagetitle">
              <strong>Ресурс:</strong>
              <span>{{ file.resource_pagetitle }}</span>
            </div>
            <div class="detail-item" v-if="file.user_username">
              <strong>Пользователь:</strong>
              <span>{{ file.user_username }}</span>
            </div>
            <div class="detail-item" v-if="file.list !== 'default'">
              <strong>Список:</strong>
              <span>{{ file.list }}</span>
            </div>
          </div>
          
          <div v-if="file.description" class="file-description-full">
            <strong>Описание:</strong>
            <p>{{ file.description }}</p>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button 
          @click="downloadFile"
          class="btn btn-primary"
        >
          <span class="icon">⬇</span>
          Скачать
        </button>
        <button 
          @click="closeDialog"
          class="btn btn-secondary"
        >
          Закрыть
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileViewDialog',
  props: {
    file: {
      type: Object,
      required: true
    },
    apiEndpoint: {
      type: String,
      default: '/api/file-gallery'
    }
  },
  data() {
    return {
      imageLoading: true,
      textContent: null,
      textLoading: false,
      zoomLevel: 1,
      minZoom: 0.1,
      maxZoom: 5
    }
  },
  computed: {
    isTextFile() {
      const textTypes = ['txt', 'json', 'xml', 'html', 'css', 'js', 'php', 'py', 'md']
      return textTypes.includes(this.file.type.toLowerCase())
    }
  },
  created() {
    if (this.isTextFile) {
      this.loadTextContent()
    }
  },
  methods: {
    closeDialog() {
      this.$emit('close')
    },

    downloadFile() {
      window.open(`${this.apiEndpoint}/${this.file.id}?action=download`, '_blank')
    },

    handleImageLoad() {
      this.imageLoading = false
    },

    handleImageError() {
      this.imageLoading = false
    },

    zoomIn() {
      if (this.zoomLevel < this.maxZoom) {
        this.zoomLevel = Math.min(this.zoomLevel * 1.2, this.maxZoom)
        this.updateImageZoom()
      }
    },

    zoomOut() {
      if (this.zoomLevel > this.minZoom) {
        this.zoomLevel = Math.max(this.zoomLevel / 1.2, this.minZoom)
        this.updateImageZoom()
      }
    },

    resetZoom() {
      this.zoomLevel = 1
      this.updateImageZoom()
    },

    updateImageZoom() {
      const image = this.$el.querySelector('.preview-image')
      if (image) {
        image.style.transform = `scale(${this.zoomLevel})`
      }
    },

    async loadTextContent() {
      if (!this.isTextFile) return

      this.textLoading = true
      try {
        const response = await fetch(`${this.apiEndpoint}/${this.file.id}?action=content`)
        const data = await response.json()

        if (data.success) {
          this.textContent = data.data.content
        } else {
          console.error('Ошибка загрузки содержимого:', data.message)
        }
      } catch (error) {
        console.error('Ошибка загрузки содержимого:', error)
      } finally {
        this.textLoading = false
      }
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
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 95%;
  max-width: 1000px;
  max-height: 95vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 1rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
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
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.file-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

.image-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border-radius: 8px;
  overflow: auto;
  position: relative;
  min-height: 400px;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.2s ease;
  cursor: grab;
}

.preview-image:active {
  cursor: grabbing;
}

.image-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #666;
}

.image-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  margin-top: 0.5rem;
  justify-content: center;
}

.zoom-level {
  font-size: 0.875rem;
  color: #666;
  margin-left: 0.5rem;
}

.pdf-viewer {
  height: 600px;
  display: flex;
  flex-direction: column;
}

.pdf-frame {
  flex: 1;
  border: none;
  border-radius: 4px;
}

.viewer-hint {
  text-align: center;
  color: #666;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.viewer-hint a {
  color: #007bff;
  text-decoration: none;
}

.viewer-hint a:hover {
  text-decoration: underline;
}

.text-viewer {
  height: 500px;
  display: flex;
  flex-direction: column;
}

.text-content {
  flex: 1;
  background: #f8f9fa;
  border-radius: 4px;
  padding: 1rem;
  overflow: auto;
}

.text-content pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.text-loading,
.text-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #666;
}

.text-error {
  color: #dc3545;
}

.file-info-viewer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  min-height: 400px;
}

.file-icon-large {
  font-size: 5rem;
  color: #666;
  margin-bottom: 1rem;
}

.file-info-viewer h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  word-break: break-word;
}

.file-type {
  color: #666;
  font-size: 1.125rem;
  margin-bottom: 1rem;
}

.file-description {
  color: #666;
  margin-bottom: 2rem;
  max-width: 500px;
}

.file-details {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
}

.file-details h5 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.detail-item strong {
  color: #333;
  margin-right: 0.5rem;
}

.file-description-full {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e5e5;
}

.file-description-full strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #333;
}

.file-description-full p {
  margin: 0;
  color: #666;
  line-height: 1.5;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Стили для иконок */
.icon {
  font-size: 1rem;
  line-height: 1;
  display: inline-block;
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

.btn-outline {
  background: transparent;
  color: #666;
}

.btn-outline:hover:not(:disabled) {
  background: #f8f9fa;
}

.btn-outline-primary {
  background: transparent;
  border-color: #007bff;
  color: #007bff;
}

.btn-outline-primary:hover:not(:disabled) {
  background: #007bff;
  color: white;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

@media (max-width: 768px) {
  .modal-dialog {
    width: 98%;
    height: 98vh;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .detail-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .image-controls {
    flex-wrap: wrap;
  }
}
</style>
