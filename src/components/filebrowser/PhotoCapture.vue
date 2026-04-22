<template>
  <Dialog
    v-model:visible="internalVisible"
    header="Снимок документа"
    :modal="true"
    :dismissableMask="false"
    :style="{ width: '92vw', height: '90vh' }"
    :pt="{
      root: { style: 'display:flex; flex-direction:column;' },
      content: { style: 'flex:1 1 auto; display:flex; flex-direction:column; min-height:0; padding:0.5rem;' }
    }"
    @hide="cleanup"
  >
    <div class="photo-capture">
      <div v-if="status === 'idle' || status === 'loading-camera'" class="notice">
        Инициализация камеры…
      </div>
      <div v-else-if="status === 'error'" class="notice error">
        Ошибка: {{ errorMsg }}
      </div>
      <div v-else-if="status === 'uploading'" class="notice">
        {{ uploadMsg || 'Загрузка на сервер…' }}
      </div>

      <!-- Live preview -->
      <div v-show="status === 'ready'" class="stage">
        <video ref="videoEl" autoplay playsinline muted class="video"></video>
      </div>

      <!-- Captured editor -->
      <div v-show="status === 'captured'" class="stage editor" ref="stageEl">
        <div class="edit-wrap" :style="{ transform: `scale(${zoom})` }">
          <canvas ref="displayEl" class="result"></canvas>
          <div class="crop-overlay" :style="cropStyle"></div>
          <div
            class="crop-rect"
            :style="cropStyle"
            @pointerdown="onCropPointerDown('move', $event)"
          >
            <span class="crop-handle tl" @pointerdown.stop="onCropPointerDown('tl', $event)"></span>
            <span class="crop-handle tr" @pointerdown.stop="onCropPointerDown('tr', $event)"></span>
            <span class="crop-handle bl" @pointerdown.stop="onCropPointerDown('bl', $event)"></span>
            <span class="crop-handle br" @pointerdown.stop="onCropPointerDown('br', $event)"></span>
          </div>
        </div>
      </div>

      <!-- Controls (после снимка) -->
      <div v-if="status === 'captured'" class="controls">
        <button type="button" class="ctrl-btn" title="Повернуть против часовой" @click="rotateBy(-90)">
          <i class="pi pi-undo"></i>
        </button>
        <button type="button" class="ctrl-btn" title="Повернуть по часовой" @click="rotateBy(90)">
          <i class="pi pi-refresh"></i>
        </button>
        <label class="zoom">
          <i class="pi pi-search-minus"></i>
          <input type="range" min="1" max="3" step="0.05" v-model.number="zoom">
          <i class="pi pi-search-plus"></i>
        </label>
        <button type="button" class="ctrl-btn" title="Сбросить" @click="resetEdits">
          <i class="pi pi-times"></i>&nbsp;Сброс
        </button>
        <button type="button" class="ctrl-btn ctrl-btn-add" title="Добавить страницу и снять ещё один лист" @click="addPageAndContinue">
          <i class="pi pi-plus"></i>&nbsp;Добавить лист
        </button>
      </div>

      <!-- Миниатюры уже сфотографированных листов -->
      <div v-if="pages.length" class="pages-strip">
        <div class="pages-strip-label">Листов: {{ pages.length }}</div>
        <div class="pages-strip-scroll">
          <div
            v-for="(p, idx) in pages"
            :key="p.id"
            class="page-thumb"
          >
            <img :src="p.thumb" :alt="`Лист ${idx + 1}`" />
            <span class="page-num">{{ idx + 1 }}</span>
            <button class="remove-thumb" title="Удалить страницу" @click="removePage(idx)">
              <i class="pi pi-times"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer">
        <button v-if="status === 'ready'" class="p-button p-component" @click="capture">
          <i class="pi pi-camera"></i>&nbsp;
          <span>{{ pages.length ? `Снять лист ${pages.length + 1}` : 'Снять' }}</span>
        </button>
        <button
          v-if="status === 'ready' && pages.length"
          class="p-button p-component p-button-success"
          @click="finalizeUpload"
        >
          <i class="pi pi-check"></i>&nbsp;Сохранить PDF ({{ pages.length }} лист.)
        </button>
        <template v-if="status === 'captured'">
          <button class="p-button p-component p-button-secondary" @click="retake">
            <i class="pi pi-refresh"></i>&nbsp;Переснять
          </button>
          <button class="p-button p-component p-button-success" @click="uploadCaptured">
            <i class="pi pi-check"></i>&nbsp;
            <span v-if="pages.length">Сохранить PDF ({{ pages.length + 1 }} лист.)</span>
            <span v-else>Использовать</span>
          </button>
        </template>
        <button class="p-button p-component p-button-text" @click="close">Отмена</button>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import Dialog from 'primevue/dialog'
import { jsPDF } from 'jspdf'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mediaSource: { type: [Number, String], default: 1 },
  uploadPath: { type: String, default: '/' },
  fileName: { type: String, default: '' },
})
const emit = defineEmits(['update:visible', 'fileUploaded'])

const internalVisible = ref(props.visible)
const status   = ref('idle')
const errorMsg = ref('')
const uploadMsg = ref('')
const videoEl  = ref(null)
const stageEl  = ref(null)
const displayEl = ref(null)

let stream = null
let capturedCanvas = null
let editedCanvas   = null

const rotation = ref(0)
const zoom     = ref(1)
const crop = ref({ x: 0, y: 0, w: 0, h: 0 })

// Накопленные страницы: каждая содержит canvas с финальным изображением + thumb (dataURL)
const pages = ref([])
let pageCounter = 0

watch(() => props.visible, v => { internalVisible.value = v; if (v) start() })
watch(internalVisible, v => { emit('update:visible', v); if (!v) cleanup() })

/* ─── Камера ─── */
const start = async () => {
  try {
    errorMsg.value = ''
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Камера недоступна. Нужен HTTPS или localhost.')
    }
    status.value = 'loading-camera'
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 4096 },
        height: { ideal: 2160 },
      },
      audio: false,
    })
    await nextTick()
    const v = videoEl.value
    v.srcObject = stream
    await v.play()

    try {
      const track = stream.getVideoTracks()[0]
      const caps = track.getCapabilities?.() ?? {}
      if (caps.width?.max && (track.getSettings().width || 0) < caps.width.max) {
        await track.applyConstraints({
          width:  { ideal: caps.width.max },
          height: { ideal: caps.height?.max || track.getSettings().height },
        }).catch(() => {})
      }
    } catch (_) {}

    status.value = 'ready'
  } catch (e) {
    errorMsg.value = e.message || 'Ошибка камеры'
    status.value = 'error'
  }
}

/* ─── Снимок ─── */
const capture = async () => {
  const v = videoEl.value
  if (!v || !stream) return
  try {
    if (typeof window.ImageCapture === 'function') {
      const track = stream.getVideoTracks()[0]
      if (track) {
        try {
          const capturer = new window.ImageCapture(track)
          const caps = await capturer.getPhotoCapabilities?.().catch(() => null)
          const settings = {}
          if (caps?.imageWidth?.max)  settings.imageWidth  = caps.imageWidth.max
          if (caps?.imageHeight?.max) settings.imageHeight = caps.imageHeight.max
          const blob = await capturer.takePhoto(Object.keys(settings).length ? settings : undefined)
          const bmp = await createImageBitmap(blob)
          setCaptured(bmp, bmp.width, bmp.height)
          return
        } catch (e) { /* fallback */ }
      }
    }
    setCaptured(v, v.videoWidth, v.videoHeight)
  } catch (e) {
    errorMsg.value = e.message || String(e)
    status.value = 'error'
  }
}

const setCaptured = (source, w, h) => {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  c.getContext('2d').drawImage(source, 0, 0, w, h)
  capturedCanvas = c
  rotation.value = 0
  zoom.value = 1
  rebuildEdited()
  status.value = 'captured'
  nextTick(() => renderDisplay())
}

/* ─── Редактор: rotate + zoom ─── */
const rotateBy = (deg) => {
  rotation.value = ((rotation.value + deg) % 360 + 360) % 360
  rebuildEdited()
  nextTick(() => renderDisplay())
}

const rebuildEdited = () => {
  if (!capturedCanvas) return
  const r = rotation.value
  const sw = capturedCanvas.width, sh = capturedCanvas.height
  const canvas = document.createElement('canvas')
  if (r === 90 || r === 270) { canvas.width = sh; canvas.height = sw }
  else { canvas.width = sw; canvas.height = sh }
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((r * Math.PI) / 180)
  ctx.drawImage(capturedCanvas, -sw / 2, -sh / 2)
  editedCanvas = canvas
}

const renderDisplay = () => {
  const d = displayEl.value
  const stage = stageEl.value
  if (!d || !editedCanvas || !stage) return
  const maxW = stage.clientWidth
  const maxH = stage.clientHeight
  const ratio = editedCanvas.width / editedCanvas.height
  let w = maxW, h = maxW / ratio
  if (h > maxH) { h = maxH; w = h * ratio }
  d.width  = Math.round(w)
  d.height = Math.round(h)
  d.getContext('2d').drawImage(editedCanvas, 0, 0, d.width, d.height)
  crop.value = { x: 0, y: 0, w: d.width, h: d.height }
}

const resetEdits = () => {
  rotation.value = 0
  zoom.value = 1
  rebuildEdited()
  nextTick(() => renderDisplay())
}

/* ─── Crop drag ─── */
const cropStyle = computed(() => ({
  left:   crop.value.x + 'px',
  top:    crop.value.y + 'px',
  width:  crop.value.w + 'px',
  height: crop.value.h + 'px',
}))

let dragMode = null
let dragStart = null

const onCropPointerDown = (mode, e) => {
  e.preventDefault()
  dragMode = mode
  dragStart = { x: e.clientX, y: e.clientY, crop: { ...crop.value } }
  window.addEventListener('pointermove', onCropPointerMove)
  window.addEventListener('pointerup',   onCropPointerUp,   { once: true })
}

const onCropPointerMove = (e) => {
  if (!dragMode || !dragStart) return
  const d = displayEl.value
  if (!d) return
  const dx = (e.clientX - dragStart.x) / zoom.value
  const dy = (e.clientY - dragStart.y) / zoom.value
  const c0 = dragStart.crop
  const max = { w: d.width, h: d.height }
  const MIN = 30

  let c = { ...c0 }
  if (dragMode === 'move') {
    c.x = Math.max(0, Math.min(max.w - c0.w, c0.x + dx))
    c.y = Math.max(0, Math.min(max.h - c0.h, c0.y + dy))
  } else {
    if (dragMode.includes('l')) {
      const nx = Math.max(0, Math.min(c0.x + c0.w - MIN, c0.x + dx))
      c.w = c0.w + (c0.x - nx); c.x = nx
    }
    if (dragMode.includes('r')) {
      c.w = Math.max(MIN, Math.min(max.w - c0.x, c0.w + dx))
    }
    if (dragMode.includes('t')) {
      const ny = Math.max(0, Math.min(c0.y + c0.h - MIN, c0.y + dy))
      c.h = c0.h + (c0.y - ny); c.y = ny
    }
    if (dragMode.includes('b')) {
      c.h = Math.max(MIN, Math.min(max.h - c0.y, c0.h + dy))
    }
  }
  crop.value = c
}

const onCropPointerUp = () => {
  dragMode = null; dragStart = null
  window.removeEventListener('pointermove', onCropPointerMove)
}

/* ─── Сборка финального canvas ─── */
const retake = () => {
  capturedCanvas = null; editedCanvas = null
  status.value = 'ready'
}

const buildFinalCanvas = () => {
  if (!editedCanvas) return null
  const d = displayEl.value
  const scaleX = editedCanvas.width  / d.width
  const scaleY = editedCanvas.height / d.height
  const sx = Math.max(0, Math.round(crop.value.x * scaleX))
  const sy = Math.max(0, Math.round(crop.value.y * scaleY))
  const sw = Math.max(1, Math.round(crop.value.w * scaleX))
  const sh = Math.max(1, Math.round(crop.value.h * scaleY))
  const out = document.createElement('canvas')
  out.width = sw; out.height = sh
  out.getContext('2d').drawImage(editedCanvas, sx, sy, sw, sh, 0, 0, sw, sh)
  return out
}

// Делает маленький thumb из canvas для миниатюры внизу
const makeThumb = (canvas, maxSide = 140) => {
  const ratio = canvas.width / canvas.height
  const w = ratio > 1 ? maxSide : Math.round(maxSide * ratio)
  const h = ratio > 1 ? Math.round(maxSide / ratio) : maxSide
  const t = document.createElement('canvas')
  t.width = w; t.height = h
  t.getContext('2d').drawImage(canvas, 0, 0, w, h)
  return t.toDataURL('image/jpeg', 0.75)
}

/* ─── Страницы (многостраничный режим) ─── */
const addPageAndContinue = () => {
  const fc = buildFinalCanvas()
  if (!fc) return
  pages.value.push({
    id: ++pageCounter,
    canvas: fc,
    thumb: makeThumb(fc),
  })
  capturedCanvas = null
  editedCanvas = null
  status.value = 'ready'
}

const removePage = (idx) => {
  pages.value.splice(idx, 1)
}

/* ─── Сохранение ─── */
const sanitizeBaseName = () => {
  const base = props.fileName?.trim()
    ? props.fileName.replace(/[^\w\-а-яё]/gi, '_')
    : `photo_${Date.now()}`
  return base
}

// Собирает все страницы в единый PDF (A4 portrait, картинка центрирована с сохранением пропорций)
const buildPdfBlob = (canvases) => {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  canvases.forEach((cv, i) => {
    if (i > 0) pdf.addPage()
    const imgRatio = cv.width / cv.height
    const pageRatio = pageW / pageH
    let drawW, drawH
    if (imgRatio > pageRatio) { drawW = pageW; drawH = pageW / imgRatio }
    else                      { drawH = pageH; drawW = pageH * imgRatio }
    const x = (pageW - drawW) / 2
    const y = (pageH - drawH) / 2
    const dataUrl = cv.toDataURL('image/jpeg', 0.85)
    pdf.addImage(dataUrl, 'JPEG', x, y, drawW, drawH)
  })
  return pdf.output('blob')
}

const uploadFile = async (blob, ext) => {
  status.value = 'uploading'
  const base = sanitizeBaseName()
  const filename = `${base}.${ext}`
  const fd = new FormData()
  fd.append('path',   props.uploadPath)
  fd.append('source', String(props.mediaSource))
  fd.append('file',   blob, filename)

  const resp = await fetch(`/api/files?action=upload&source=${encodeURIComponent(props.mediaSource)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: fd,
  })
  const json = await resp.json()
  if (!json?.success) throw new Error(json?.message || 'Ошибка загрузки')

  const listResp = await fetch(`/api/files?path=${encodeURIComponent(props.uploadPath)}&source=${encodeURIComponent(props.mediaSource)}`, {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  const listJson = await listResp.json()
  const match = (listJson?.data?.files || []).find(f => f.name === filename)
  const url = match?.url || `${props.uploadPath.replace(/\/$/, '')}/${filename}`

  emit('fileUploaded', { url, name: filename })
  close()
}

// Вызывается из стадии 'captured' — собирает все страницы (вкл. текущий crop) и загружает
const uploadCaptured = async () => {
  const fc = buildFinalCanvas()
  if (!fc) return
  try {
    if (pages.value.length === 0) {
      // один лист → JPG как раньше
      uploadMsg.value = 'Загрузка снимка…'
      const blob = await new Promise(res => fc.toBlob(res, 'image/jpeg', 0.9))
      await uploadFile(blob, 'jpg')
    } else {
      // несколько листов → PDF
      uploadMsg.value = `Сборка PDF (${pages.value.length + 1} лист.)…`
      status.value = 'uploading'
      await nextTick()
      const allCanvases = [...pages.value.map(p => p.canvas), fc]
      const pdfBlob = buildPdfBlob(allCanvases)
      uploadMsg.value = 'Загрузка PDF на сервер…'
      await uploadFile(pdfBlob, 'pdf')
    }
  } catch (e) {
    errorMsg.value = e.message || 'Ошибка загрузки'
    status.value = 'error'
  }
}

// Вызывается из стадии 'ready', когда уже есть страницы и пользователь решил больше не снимать
const finalizeUpload = async () => {
  if (!pages.value.length) return
  try {
    uploadMsg.value = `Сборка PDF (${pages.value.length} лист.)…`
    status.value = 'uploading'
    await nextTick()
    const pdfBlob = buildPdfBlob(pages.value.map(p => p.canvas))
    uploadMsg.value = 'Загрузка PDF на сервер…'
    await uploadFile(pdfBlob, 'pdf')
  } catch (e) {
    errorMsg.value = e.message || 'Ошибка загрузки'
    status.value = 'error'
  }
}

const close = () => { internalVisible.value = false }

const cleanup = () => {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  capturedCanvas = null; editedCanvas = null
  pages.value = []
  pageCounter = 0
  uploadMsg.value = ''
  status.value = 'idle'
}

onMounted(() => { if (props.visible) start() })
onBeforeUnmount(cleanup)

watch(zoom, () => { /* zoom — чисто CSS */ })
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { if (status.value === 'captured') renderDisplay() })
}
</script>

<style scoped>
.photo-capture { display: flex; flex-direction: column; height: 100%; gap: 0.5rem; }
.notice { padding: 1rem; text-align: center; color: #555; }
.notice.error { color: #c00; font-weight: 600; }
.stage {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  min-height: 0;
  overflow: hidden;
}
.video { max-width: 100%; max-height: 100%; object-fit: contain; }
.editor .edit-wrap {
  position: relative;
  transform-origin: center center;
  line-height: 0;
}
.result { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }

.crop-overlay {
  position: absolute;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.6);
}
.crop-rect {
  position: absolute;
  cursor: move;
  border: 1px solid rgba(255, 255, 255, 0.9);
}
.crop-handle {
  position: absolute;
  width: 14px; height: 14px;
  background: #fff;
  border: 1px solid #333;
  border-radius: 2px;
  touch-action: none;
}
.crop-handle.tl { top: -7px;  left: -7px;   cursor: nwse-resize; }
.crop-handle.tr { top: -7px;  right: -7px;  cursor: nesw-resize; }
.crop-handle.bl { bottom: -7px; left: -7px; cursor: nesw-resize; }
.crop-handle.br { bottom: -7px; right: -7px; cursor: nwse-resize; }

.controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: #f8fafc;
  border-top: 1px solid #e5e7eb;
  flex-wrap: wrap;
}
.ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}
.ctrl-btn:hover { background: #e2e8f0; }
.ctrl-btn-add {
  background: #ecfdf5;
  border-color: #10b981;
  color: #065f46;
  font-weight: 600;
}
.ctrl-btn-add:hover { background: #d1fae5; }
.zoom {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 180px;
}
.zoom input[type='range'] { flex: 1; }

/* Миниатюры страниц */
.pages-strip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  background: #f1f5f9;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
}
.pages-strip-label {
  font-size: 0.85rem;
  color: #334155;
  font-weight: 600;
  white-space: nowrap;
}
.pages-strip-scroll {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  flex: 1;
  padding-bottom: 2px;
}
.page-thumb {
  position: relative;
  flex: 0 0 auto;
  width: 72px;
  height: 72px;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.page-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}
.page-thumb .page-num {
  position: absolute;
  top: 2px;
  left: 2px;
  background: rgba(15, 23, 42, 0.75);
  color: #fff;
  font-size: 0.7rem;
  padding: 1px 5px;
  border-radius: 4px;
}
.page-thumb .remove-thumb {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: none;
  background: rgba(220, 38, 38, 0.9);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  padding: 0;
}
.page-thumb .remove-thumb:hover { background: #dc2626; }

.footer { display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; }
</style>
