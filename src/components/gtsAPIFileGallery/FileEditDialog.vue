<template>
  <div class="modal-overlay" @click="closeDialog">
    <div class="modal-dialog" @click.stop>
      <div class="modal-header">
        <h4 class="modal-title">Редактирование файла</h4>
        <button @click="closeDialog" class="btn-close">
          <span class="icon">✕</span>
        </button>
      </div>

      <div class="modal-body">
        <!-- Превью файла -->
        <div class="file-preview">
          <div class="preview-container">
            <img 
              v-if="file.is_image"
              :src="file.thumbnail_url"
              :alt="file.name"
              class="preview-image"
              @error="handleImageError"
            />
            <div v-else class="preview-icon">
              <span>{{ getFileIcon(file.type) }}</span>
            </div>
          </div>
          <div class="file-meta">
            <div class="meta-item">
              <strong>Размер:</strong> {{ file.format_size }}
            </div>
            <div class="meta-item">
              <strong>Тип:</strong> {{ file.type.toUpperCase() }}
            </div>
            <div class="meta-item">
              <strong>Дата создания:</strong> {{ file.format_createdon }}
            </div>
            <div class="meta-item" v-if="file.resource_pagetitle">
              <strong>Ресурс:</strong> {{ file.resource_pagetitle }}
            </div>
            <div class="meta-item" v-if="file.user_username">
              <strong>Пользователь:</strong> {{ file.user_username }}
            </div>
          </div>
        </div>

        <!-- Форма редактирования -->
        <form @submit.prevent="saveFile" class="edit-form">
          <div class="form-group">
            <label for="fileName">Название файла:</label>
            <input
              id="fileName"
              v-model="editData.name"
              type="text"
              class="form-control"
              :class="{ 'is-invalid': errors.name }"
              required
            />
            <div v-if="errors.name" class="invalid-feedback">
              {{ errors.name }}
            </div>
          </div>

          <div class="form-group">
            <label for="fileDescription">Описание:</label>
            <textarea
              id="fileDescription"
              v-model="editData.description"
              class="form-control"
              rows="3"
              placeholder="Описание файла..."
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="fileRank">Порядок сортировки:</label>
              <input
                id="fileRank"
                v-model.number="editData.rank"
                type="number"
                class="form-control"
                min="0"
              />
            </div>

            <div class="form-group">
              <label for="fileActive">Статус:</label>
              <select
                id="fileActive"
                v-model="editData.active"
                class="form-control"
              >
                <option :value="1">Активен</option>
                <option :value="0">Неактивен</option>
              </select>
            </div>
          </div>

          <!-- Привязка к объектам -->
          <div class="attachment-section">
            <h5>Привязка к объектам</h5>
            
            <div class="form-row">
              <div class="form-group">
                <label for="parentClass">Тип объекта:</label>
                <select
                  id="parentClass"
                  v-model="editData.class"
                  class="form-control"
                  @change="onClassChange"
                >
                  <option value="modResource">Ресурс</option>
                  <option value="modUser">Пользователь</option>
                  <option value="">Без привязки</option>
                </select>
              </div>

              <div class="form-group" v-if="editData.class">
                <label for="parentId">ID объекта:</label>
                <input
                  id="parentId"
                  v-model.number="editData.parent"
                  type="number"
                  class="form-control"
                  min="0"
                  placeholder="0 - без привязки"
                />
              </div>
            </div>

            <div class="form-group" v-if="editData.class">
              <label for="listName">Список:</label>
              <input
                id="listName"
                v-model="editData.list"
                type="text"
                class="form-control"
                placeholder="default"
              />
              <small class="form-text text-muted">
                Название списка для группировки файлов
              </small>
            </div>
          </div>

          <!-- Дополнительные действия -->
          <div class="actions-section" v-if="file.is_image">
            <h5>Дополнительные действия</h5>
            
            <div class="action-buttons">
              <button
                type="button"
                @click="generateThumbnails"
                class="btn btn-outline-primary"
                :disabled="isGeneratingThumbnails"
              >
                <span v-if="isGeneratingThumbnails" class="spinner">⟳</span>
                <span v-else class="icon">🖼</span>
                {{ isGeneratingThumbnails ? 'Генерация...' : 'Создать миниатюры' }}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div class="modal-footer">
        <button 
          @click="closeDialog"
          type="button"
          class="btn btn-secondary"
          :disabled="isSaving"
        >
          Отмена
        </button>
        <button 
          @click="saveFile"
          type="button"
          class="btn btn-primary"
          :disabled="isSaving || !isFormValid"
        >
          <span v-if="isSaving" class="spinner">⟳</span>
          <span v-else class="icon">💾</span>
          {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileEditDialog',
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
      editData: {
        name: '',
        description: '',
        rank: 0,
        active: 1,
        class: 'modResource',
        parent: 0,
        list: 'default'
      },
      errors: {},
      isSaving: false,
      isGeneratingThumbnails: false
    }
  },
  computed: {
    isFormValid() {
      return this.editData.name.trim().length > 0 && Object.keys(this.errors).length === 0
    }
  },
  created() {
    this.initializeForm()
  },
  methods: {
    initializeForm() {
      this.editData = {
        name: this.file.name || '',
        description: this.file.description || '',
        rank: this.file.rank || 0,
        active: this.file.active !== undefined ? this.file.active : 1,
        class: this.file.class || 'modResource',
        parent: this.file.parent || 0,
        list: this.file.list || 'default'
      }
    },

    closeDialog() {
      if (!this.isSaving) {
        this.$emit('close')
      }
    },

    validateForm() {
      this.errors = {}

      // Валидация имени
      if (!this.editData.name.trim()) {
        this.errors.name = 'Название файла обязательно'
      } else if (this.editData.name.trim().length < 2) {
        this.errors.name = 'Название должно содержать минимум 2 символа'
      }

      return Object.keys(this.errors).length === 0
    },

    async saveFile() {
      if (!this.validateForm() || this.isSaving) {
        return
      }

      this.isSaving = true

      try {
        const response = await fetch(`${this.apiEndpoint}/${this.file.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'update',
            ...this.editData
          })
        })

        const data = await response.json()

        if (data.success) {
          this.$emit('updated', data.data)
          this.closeDialog()
        } else {
          this.handleError(data.message)
        }
      } catch (error) {
        this.handleError('Ошибка сохранения: ' + error.message)
      } finally {
        this.isSaving = false
      }
    },

    async generateThumbnails() {
      if (this.isGeneratingThumbnails) return

      this.isGeneratingThumbnails = true

      try {
        const response = await fetch(`${this.apiEndpoint}/${this.file.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'generate_thumbnails'
          })
        })

        const data = await response.json()

        if (data.success) {
          this.$emit('updated', this.file)
          this.showSuccess('Миниатюры успешно созданы')
        } else {
          this.handleError(data.message)
        }
      } catch (error) {
        this.handleError('Ошибка создания миниатюр: ' + error.message)
      } finally {
        this.isGeneratingThumbnails = false
      }
    },

    onClassChange() {
      if (!this.editData.class) {
        this.editData.parent = 0
        this.editData.list = 'default'
      }
    },

    handleError(message) {
      // Можно добавить toast уведомления или другой способ показа ошибок
      alert('Ошибка: ' + message)
    },

    showSuccess(message) {
      // Можно добавить toast уведомления или другой способ показа успеха
      alert('Успех: ' + message)
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
    },

    handleImageError(event) {
      event.target.style.display = 'none'
      const icon = document.createElement('span')
      icon.className = 'file-icon-error'
      icon.textContent = '🖼'
      event.target.parentNode.appendChild(icon)
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
  max-width: 700px;
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

.file-preview {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.preview-container {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e5e5;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.preview-icon {
  font-size: 3rem;
  color: #666;
}

.file-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-item {
  font-size: 0.875rem;
}

.meta-item strong {
  color: #333;
  margin-right: 0.5rem;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group label {
  font-weight: 500;
  color: #333;
  font-size: 0.875rem;
}

.form-control {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-control.is-invalid {
  border-color: #dc3545;
}

.invalid-feedback {
  color: #dc3545;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.form-text {
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.25rem;
}

.text-muted {
  color: #666;
}

.attachment-section,
.actions-section {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-top: 1rem;
}

.attachment-section h5,
.actions-section h5 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
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

.btn-outline-primary {
  background: transparent;
  border-color: #007bff;
  color: #007bff;
}

.btn-outline-primary:hover:not(:disabled) {
  background: #007bff;
  color: white;
}

.file-icon-error {
  font-size: 2rem;
  color: #dc3545;
}

.fa-spin {
  animation: fa-spin 1s infinite linear;
}

@keyframes fa-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

@media (max-width: 768px) {
  .file-preview {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .modal-dialog {
    width: 95%;
    margin: 1rem;
  }
}
</style>
