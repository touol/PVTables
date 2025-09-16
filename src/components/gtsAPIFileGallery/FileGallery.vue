<template>
  <div class="file-gallery">
    <!-- Заголовок и кнопки управления -->
    <div class="gallery-header">
      <h3 class="gallery-title">{{ title || 'Галерея файлов' }}</h3>
      <div class="gallery-actions">
        <button 
          v-if="allowUpload"
          @click="showUploadDialog = true"
          class="btn btn-primary"
        >
          <span class="icon">⬆</span>
          Загрузить файлы
        </button>
        <button 
          @click="refreshFiles"
          class="btn btn-secondary"
        >
          <span class="icon">↻</span>
          Обновить
        </button>
      </div>
    </div>

    <!-- Фильтры -->
    <div class="gallery-filters" v-if="showFilters">
      <div class="filter-row">
        <div class="filter-group">
          <label>Поиск:</label>
          <input 
            v-model="filters.search"
            @input="debouncedSearch"
            type="text"
            placeholder="Поиск по имени файла..."
            class="form-control"
          />
        </div>
        <div class="filter-group">
          <label>Тип файла:</label>
          <select v-model="filters.type" @change="loadFiles" class="form-control">
            <option value="">Все типы</option>
            <option value="jpg">JPG</option>
            <option value="png">PNG</option>
            <option value="gif">GIF</option>
            <option value="pdf">PDF</option>
            <option value="doc">DOC</option>
            <option value="docx">DOCX</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Вид:</label>
          <div class="view-toggle">
            <button 
              @click="viewMode = 'grid'"
              :class="{ active: viewMode === 'grid' }"
              class="btn btn-sm"
            >
              <span class="icon">⊞</span>
            </button>
            <button 
              @click="viewMode = 'list'"
              :class="{ active: viewMode === 'list' }"
              class="btn btn-sm"
            >
              <span class="icon">☰</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Загрузка -->
    <div v-if="loading" class="gallery-loading">
      <div class="spinner"></div>
      <p>Загрузка файлов...</p>
    </div>

    <!-- Список файлов -->
    <div v-else class="gallery-content">
      <!-- Сетка файлов -->
      <div v-if="viewMode === 'grid'" class="files-grid">
        <div 
          v-for="file in files"
          :key="file.id"
          class="file-item"
          :class="{ 
            selected: selectedFiles.includes(file.id),
            dragging: draggedFile && draggedFile.id === file.id,
            'drag-over': dragOverFile && dragOverFile.id === file.id
          }"
          draggable="true"
          @click="selectFile(file)"
          @dblclick="openFile(file)"
          @dragstart="handleDragStart(file, $event)"
          @dragend="handleDragEnd"
          @dragover="handleDragOver(file, $event)"
          @dragleave="handleDragLeave"
          @drop="handleDrop(file, $event)"
        >
          <div class="file-thumbnail">
            <img 
              v-if="file.is_image"
              :src="file.thumbnail_url"
              :alt="file.name"
              @error="handleImageError"
            />
            <div v-else class="file-icon">
              <span>{{ getFileIcon(file.type) }}</span>
            </div>
          </div>
          <div class="file-info">
            <div class="file-name" :title="file.name">{{ file.name }}</div>
            <div class="file-size">{{ file.format_size }}</div>
          </div>
          <div class="file-actions" v-if="allowActions">
            <button 
              @click.stop="downloadFile(file)"
              class="btn btn-sm btn-outline"
              title="Скачать"
            >
              <span class="icon">⬇</span>
            </button>
            <button 
              v-if="allowEdit"
              @click.stop="editFile(file)"
              class="btn btn-sm btn-outline"
              title="Редактировать"
            >
              <span class="icon">✏</span>
            </button>
            <button 
              v-if="allowDelete"
              @click.stop="deleteFile(file)"
              class="btn btn-sm btn-outline btn-danger"
              title="Удалить"
            >
              <span class="icon">🗑</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Список файлов -->
      <div v-else class="files-list">
        <table class="table">
          <thead>
            <tr>
              <th v-if="allowSelection">
                <input 
                  type="checkbox"
                  @change="toggleSelectAll"
                  :checked="allSelected"
                />
              </th>
              <th>Превью</th>
              <th @click="sortBy('name')" class="sortable">
                Имя
                <span v-if="sortField === 'name'" class="sort-icon">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th @click="sortBy('type')" class="sortable">
                Тип
                <span v-if="sortField === 'type'" class="sort-icon">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th @click="sortBy('size')" class="sortable">
                Размер
                <span v-if="sortField === 'size'" class="sort-icon">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th @click="sortBy('createdon')" class="sortable">
                Дата
                <span v-if="sortField === 'createdon'" class="sort-icon">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th v-if="allowActions">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="file in files"
              :key="file.id"
              :class="{ selected: selectedFiles.includes(file.id) }"
              @click="selectFile(file)"
              @dblclick="openFile(file)"
            >
              <td v-if="allowSelection">
                <input 
                  type="checkbox"
                  :checked="selectedFiles.includes(file.id)"
                  @change="toggleFileSelection(file.id)"
                />
              </td>
              <td class="file-thumbnail-cell">
                <img 
                  v-if="file.is_image"
                  :src="file.thumbnail_url"
                  :alt="file.name"
                  class="thumbnail-small"
                  @error="handleImageError"
                />
                <span v-else class="file-icon-small">{{ getFileIcon(file.type) }}</span>
              </td>
              <td class="file-name-cell">{{ file.name }}</td>
              <td class="file-type-cell">{{ file.type.toUpperCase() }}</td>
              <td class="file-size-cell">{{ file.format_size }}</td>
              <td class="file-date-cell">{{ file.format_createdon }}</td>
              <td v-if="allowActions" class="file-actions-cell">
                <button 
                  @click.stop="downloadFile(file)"
                  class="btn btn-sm btn-outline"
                  title="Скачать"
                >
                  <span class="icon">⬇</span>
                </button>
                <button 
                  v-if="allowEdit"
                  @click.stop="editFile(file)"
                  class="btn btn-sm btn-outline"
                  title="Редактировать"
                >
                  <span class="icon">✏</span>
                </button>
                <button 
                  v-if="allowDelete"
                  @click.stop="deleteFile(file)"
                  class="btn btn-sm btn-outline btn-danger"
                  title="Удалить"
                >
                  <span class="icon">🗑</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Пагинация -->
      <div v-if="totalPages > 1" class="gallery-pagination">
        <button 
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage === 1"
          class="btn btn-sm"
        >
          <span class="icon">◀</span>
        </button>
        <span class="pagination-info">
          Страница {{ currentPage }} из {{ totalPages }}
        </span>
        <button 
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="btn btn-sm"
        >
          <span class="icon">▶</span>
        </button>
      </div>
    </div>

    <!-- Диалог загрузки -->
    <FileUploadDialog
      v-if="showUploadDialog"
      @close="showUploadDialog = false"
      @uploaded="handleFilesUploaded"
      :parent-id="parentId"
      :parent-class="parentClass"
      :list-name="listName"
    />

    <!-- Диалог редактирования -->
    <FileEditDialog
      v-if="showEditDialog"
      :file="editingFile"
      @close="showEditDialog = false"
      @updated="handleFileUpdated"
    />

    <!-- Диалог просмотра -->
    <FileViewDialog
      v-if="showViewDialog"
      :file="viewingFile"
      @close="showViewDialog = false"
    />
  </div>
</template>

<script>
import FileUploadDialog from './FileUploadDialog.vue'
import FileEditDialog from './FileEditDialog.vue'
import FileViewDialog from './FileViewDialog.vue'

export default {
  name: 'FileGallery',
  components: {
    FileUploadDialog,
    FileEditDialog,
    FileViewDialog
  },
  props: {
    title: String,
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
    allowUpload: {
      type: Boolean,
      default: true
    },
    allowEdit: {
      type: Boolean,
      default: true
    },
    allowDelete: {
      type: Boolean,
      default: true
    },
    allowActions: {
      type: Boolean,
      default: true
    },
    allowSelection: {
      type: Boolean,
      default: false
    },
    showFilters: {
      type: Boolean,
      default: true
    },
    pageSize: {
      type: Number,
      default: 20
    },
    apiEndpoint: {
      type: String,
      default: '/api/file-gallery'
    }
  },
  data() {
    return {
      files: [],
      loading: false,
      viewMode: 'grid',
      selectedFiles: [],
      currentPage: 1,
      totalFiles: 0,
      filters: {
        search: '',
        type: '',
        mime: ''
      },
      sortField: 'createdon',
      sortDirection: 'desc',
      showUploadDialog: false,
      showEditDialog: false,
      showViewDialog: false,
      editingFile: null,
      viewingFile: null,
      debouncedSearch: null,
      // Drag & Drop состояние
      draggedFile: null,
      dragOverFile: null,
      isDragging: false
    }
  },
  computed: {
    totalPages() {
      return Math.ceil(this.totalFiles / this.pageSize)
    },
    allSelected() {
      return this.files.length > 0 && this.selectedFiles.length === this.files.length
    }
  },
  created() {
    this.debouncedSearch = this.debounce(this.loadFiles, 500)
    this.loadFiles()
  },
  methods: {
    async loadFiles() {
      this.loading = true
      try {
        const params = {
          action: 'list',
          parent: this.parentId,
          class: this.parentClass,
          list: this.listName,
          limit: this.pageSize,
          trumb: '',
          offset: (this.currentPage - 1) * this.pageSize,
          ...this.filters
        }

        const response = await fetch(`${this.apiEndpoint}?${new URLSearchParams(params)}`)
        const data = await response.json()

        if (data.success) {
          this.files = data.data.files
          this.totalFiles = data.data.total
        } else {
          this.$emit('error', data.message)
        }
      } catch (error) {
        this.$emit('error', 'Ошибка загрузки файлов: ' + error.message)
      } finally {
        this.loading = false
      }
    },

    refreshFiles() {
      this.selectedFiles = []
      this.loadFiles()
    },

    selectFile(file) {
      if (this.allowSelection) {
        this.toggleFileSelection(file.id)
      }
      this.$emit('file-selected', file)
    },

    toggleFileSelection(fileId) {
      const index = this.selectedFiles.indexOf(fileId)
      if (index > -1) {
        this.selectedFiles.splice(index, 1)
      } else {
        this.selectedFiles.push(fileId)
      }
      this.$emit('selection-changed', this.selectedFiles)
    },

    toggleSelectAll() {
      if (this.allSelected) {
        this.selectedFiles = []
      } else {
        this.selectedFiles = this.files.map(file => file.id)
      }
      this.$emit('selection-changed', this.selectedFiles)
    },

    openFile(file) {
      this.viewingFile = file
      this.showViewDialog = true
      this.$emit('file-opened', file)
    },

    editFile(file) {
      this.editingFile = file
      this.showEditDialog = true
    },

    async deleteFile(file) {
      if (!confirm(`Вы уверены, что хотите удалить файл "${file.name}"?`)) {
        return
      }

      try {
        const response = await fetch(`${this.apiEndpoint}/${file.id}`, {
          method: 'DELETE'
        })
        const data = await response.json()

        if (data.success) {
          this.$emit('file-deleted', file)
          this.loadFiles()
        } else {
          this.$emit('error', data.message)
        }
      } catch (error) {
        this.$emit('error', 'Ошибка удаления файла: ' + error.message)
      }
    },

    downloadFile(file) {
      window.open(`${this.apiEndpoint}/${file.id}?action=download`, '_blank')
      this.$emit('file-downloaded', file)
    },

    sortBy(field) {
      if (this.sortField === field) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortField = field
        this.sortDirection = 'asc'
      }
      this.loadFiles()
    },

    goToPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page
        this.loadFiles()
      }
    },

    handleFilesUploaded(uploadedFiles) {
      this.$emit('files-uploaded', uploadedFiles)
      this.loadFiles()
    },

    handleFileUpdated(updatedFile) {
      this.$emit('file-updated', updatedFile)
      this.loadFiles()
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
    },

    // Собственная реализация debounce
    debounce(func, wait) {
      let timeout
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout)
          func(...args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
      }
    },

    // Методы для Drag & Drop
    handleDragStart(file, event) {
      this.draggedFile = file
      this.isDragging = true
      
      // Устанавливаем данные для передачи
      event.dataTransfer.setData('text/plain', file.id)
      event.dataTransfer.effectAllowed = 'move'
      
      // Добавляем визуальный эффект
      event.target.style.opacity = '0.5'
    },

    handleDragEnd(event) {
      // Сбрасываем состояние
      this.draggedFile = null
      this.dragOverFile = null
      this.isDragging = false
      
      // Убираем визуальный эффект
      event.target.style.opacity = '1'
    },

    handleDragOver(file, event) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      
      // Устанавливаем файл над которым находимся
      if (this.draggedFile && this.draggedFile.id !== file.id) {
        this.dragOverFile = file
      }
    },

    handleDragLeave(event) {
      // Убираем подсветку только если действительно покинули элемент
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.dragOverFile = null
      }
    },

    async handleDrop(targetFile, event) {
      event.preventDefault()
      
      const draggedFileId = event.dataTransfer.getData('text/plain')
      const draggedFile = this.files.find(f => f.id == draggedFileId)
      
      if (!draggedFile || draggedFile.id === targetFile.id) {
        this.handleDragEnd(event)
        return
      }

      // Определяем новые позиции
      const draggedIndex = this.files.findIndex(f => f.id === draggedFile.id)
      const targetIndex = this.files.findIndex(f => f.id === targetFile.id)
      
      // Вычисляем новый ранг для перетаскиваемого файла
      let newRank
      const currentRank = draggedFile.rank || draggedIndex * 10
      const targetRank = targetFile.rank || targetIndex * 10
      
      if (targetIndex === 0) {
        // Перемещаем в начало
        newRank = targetRank - 10
      } else if (targetIndex === this.files.length - 1) {
        // Перемещаем в конец
        newRank = targetRank + 10
      } else {
        // Перемещаем между файлами
        const prevFile = this.files[targetIndex - 1]
        const nextFile = this.files[targetIndex + 1]
        const prevRank = prevFile.rank || (targetIndex - 1) * 10
        const nextRank = nextFile.rank || (targetIndex + 1) * 10
        newRank = Math.floor((prevRank + nextRank) / 2)
      }

      try {
        // Отправляем запрос на изменение ранга
        await this.updateFileRank(draggedFile.id, newRank)
        
        // Обновляем локальные данные
        draggedFile.rank = newRank
        
        // Пересортировываем массив файлов
        this.files.sort((a, b) => {
          const aRank = a.rank || 0
          const bRank = b.rank || 0
          return aRank - bRank
        })
        
        this.$emit('file-rank-changed', {
          file: draggedFile,
          oldRank: currentRank,
          newRank: newRank
        })
        
      } catch (error) {
        this.$emit('error', 'Ошибка изменения порядка файла: ' + error.message)
      }

      this.handleDragEnd(event)
    },

    async updateFileRank(fileId, newRank) {
      const response = await fetch(`${this.apiEndpoint}/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update',
          rank: newRank
        })
      })

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Ошибка обновления ранга файла')
      }
      
      return data
    }
  }
}
</script>

<style scoped>
.file-gallery {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e5e5e5;
  background: #f8f9fa;
}

.gallery-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.gallery-actions {
  display: flex;
  gap: 0.5rem;
}

.gallery-filters {
  padding: 1rem;
  border-bottom: 1px solid #e5e5e5;
  background: #f8f9fa;
}

.filter-row {
  display: flex;
  gap: 1rem;
  align-items: end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #666;
}

.view-toggle {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.view-toggle .btn {
  border: none;
  border-radius: 0;
}

.view-toggle .btn.active {
  background: #007bff;
  color: white;
}

.gallery-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #666;
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

.gallery-content {
  padding: 1rem;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.file-item {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.file-item:hover {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0,123,255,0.15);
}

.file-item.selected {
  border-color: #007bff;
  background: #f0f8ff;
}

.file-thumbnail {
  width: 100%;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  overflow: hidden;
}

.file-thumbnail img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.file-icon {
  font-size: 3rem;
  color: #666;
}

.file-info {
  text-align: center;
}

.file-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 0.875rem;
  color: #666;
}

.file-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.file-item:hover .file-actions {
  opacity: 1;
}

.files-list {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 0.75rem;
  border-bottom: 1px solid #e5e5e5;
  text-align: left;
}

.table th {
  background: #f8f9fa;
  font-weight: 600;
}

.table th.sortable {
  cursor: pointer;
  user-select: none;
}

.table th.sortable:hover {
  background: #e9ecef;
}

.table tr:hover {
  background: #f8f9fa;
}

.table tr.selected {
  background: #f0f8ff;
}

.file-thumbnail-cell {
  width: 60px;
}

.thumbnail-small {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}

.file-icon-small {
  font-size: 1.5rem;
  color: #666;
}

.file-icon-error {
  font-size: 2rem;
  color: #dc3545;
}

.file-actions-cell {
  width: 120px;
}

.gallery-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid #e5e5e5;
}

.pagination-info {
  font-size: 0.875rem;
  color: #666;
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

.btn-primary:hover {
  background: #0056b3;
  border-color: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  border-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
  border-color: #545b62;
}

.btn-danger {
  background: #dc3545;
  border-color: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
  border-color: #c82333;
}

.btn-outline {
  background: transparent;
  color: #666;
}

.btn-outline:hover {
  background: #f8f9fa;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.form-control {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

/* Стили для иконок */
.icon {
  font-size: 1rem;
  line-height: 1;
  display: inline-block;
}

.sort-icon {
  font-size: 0.75rem;
  margin-left: 0.25rem;
  color: #007bff;
}

.file-icon span {
  font-size: 3rem;
  line-height: 1;
}

.file-icon-small {
  font-size: 1.5rem;
  line-height: 1;
}

.file-icon-error {
  font-size: 2rem;
  color: #dc3545;
  line-height: 1;
}

/* Стили для Drag & Drop */
.file-item.dragging {
  opacity: 0.5;
  transform: scale(0.95);
  border-color: #007bff;
  box-shadow: 0 4px 12px rgba(0,123,255,0.3);
}

.file-item.drag-over {
  border-color: #28a745;
  background: #f8fff9;
  box-shadow: 0 0 0 2px rgba(40,167,69,0.25);
  transform: scale(1.02);
}

.file-item[draggable="true"] {
  cursor: grab;
}

.file-item[draggable="true"]:active {
  cursor: grabbing;
}

/* Анимация для плавного перехода */
.file-item {
  transition: all 0.2s ease;
}

/* Индикатор перетаскивания */
.file-item.dragging::before {
  content: "📋";
  position: absolute;
  top: -10px;
  right: -10px;
  background: #007bff;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  z-index: 10;
}

.file-item.drag-over::after {
  content: "⬇ Отпустите здесь";
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: #28a745;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  white-space: nowrap;
  z-index: 10;
}
</style>
