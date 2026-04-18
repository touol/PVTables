<template>
  <Dialog
    v-model:visible="internalVisible"
    header="Снимок документа"
    :modal="true"
    :dismissableMask="false"
    :style="{ width: '92vw', height: '90vh' }"
    @hide="cleanup"
  >
    <div class="photo-capture">
      <div v-if="status === 'loading-scripts'" class="notice">
        Скрипты загружаются…
      </div>
      <div v-else-if="status === 'loading-camera'" class="notice">
        Инициализация камеры…
      </div>
      <div v-else-if="status === 'error'" class="notice error">
        Ошибка: {{ errorMsg }}
      </div>
      <div v-else-if="status === 'uploading'" class="notice">
        Загрузка на сервер…
      </div>

      <!-- Live preview -->
      <div v-show="status === 'ready'" class="stage">
        <video ref="videoEl" autoplay playsinline muted class="video"></video>
        <canvas ref="overlayEl" class="overlay"></canvas>
      </div>

      <!-- Captured preview -->
      <div v-show="status === 'captured'" class="stage">
        <canvas ref="resultEl" class="result"></canvas>
      </div>
    </div>

    <template #footer>
      <div class="footer">
        <button v-if="status === 'ready'" class="p-button p-component" @click="capture">
          <i class="pi pi-camera"></i>&nbsp;Снять
        </button>
        <template v-if="status === 'captured'">
          <button class="p-button p-component p-button-secondary" @click="retake">
            <i class="pi pi-refresh"></i>&nbsp;Переснять
          </button>
          <button class="p-button p-component p-button-success" @click="uploadCaptured">
            <i class="pi pi-check"></i>&nbsp;Использовать
          </button>
        </template>
        <button class="p-button p-component p-button-text" @click="close">Отмена</button>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import Dialog from 'primevue/dialog'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mediaSource: { type: [Number, String], default: 1 },
  uploadPath: { type: String, default: '/' },
  fileName: { type: String, default: '' }, // базовое имя без расширения; по умолчанию timestamp
})

const emit = defineEmits(['update:visible', 'fileUploaded'])

const internalVisible = ref(props.visible)
const status  = ref('idle') // idle | loading-scripts | loading-camera | ready | captured | uploading | error
const errorMsg = ref('')
const videoEl  = ref(null)
const overlayEl = ref(null)
const resultEl  = ref(null)

let stream = null
let rafId  = null
let scanner = null   // jscanify instance
let capturedCanvas = null

watch(() => props.visible, v => {
  internalVisible.value = v
  if (v) start()
})
watch(internalVisible, v => {
  emit('update:visible', v)
  if (!v) cleanup()
})

// ─── Загрузчики скриптов (ленивые, с кэшированием браузера) ────────────────
const CV_URL = 'https://docs.opencv.org/4.8.0/opencv.js'
const JSCANIFY_URL = 'https://cdn.jsdelivr.net/npm/jscanify@1.3.0/src/jscanify.min.js'

const loadScriptOnce = (src) => new Promise((resolve, reject) => {
  const existing = document.querySelector(`script[data-src="${src}"]`)
  if (existing) {
    if (existing.dataset.loaded === '1') return resolve()
    existing.addEventListener('load', resolve, { once: true })
    existing.addEventListener('error', reject, { once: true })
    return
  }
  const s = document.createElement('script')
  s.src = src
  s.async = true
  s.dataset.src = src
  s.addEventListener('load', () => { s.dataset.loaded = '1'; resolve() }, { once: true })
  s.addEventListener('error', () => reject(new Error('Не удалось загрузить ' + src)), { once: true })
  document.head.appendChild(s)
})

const waitCvReady = () => new Promise((resolve) => {
  const check = () => {
    if (window.cv && window.cv.Mat) return resolve(window.cv)
    setTimeout(check, 50)
  }
  check()
})

const ensureScripts = async () => {
  if (window.jscanify && window.cv && window.cv.Mat) return
  status.value = 'loading-scripts'
  if (!window.cv || !window.cv.Mat) {
    await loadScriptOnce(CV_URL)
    await waitCvReady()
  }
  if (!window.jscanify) {
    await loadScriptOnce(JSCANIFY_URL)
  }
}

// ─── Старт / стоп ─────────────────────────────────────────────────────────
const start = async () => {
  try {
    errorMsg.value = ''
    await ensureScripts()
    scanner = new window.jscanify()

    status.value = 'loading-camera'
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
    await nextTick()
    const v = videoEl.value
    v.srcObject = stream
    await v.play()
    status.value = 'ready'
    loopOverlay()
  } catch (e) {
    console.error(e)
    errorMsg.value = e.message || 'Неизвестная ошибка'
    status.value = 'error'
  }
}

const loopOverlay = () => {
  const v = videoEl.value
  const c = overlayEl.value
  if (!v || !c || status.value !== 'ready') return
  if (v.readyState >= 2 && v.videoWidth) {
    c.width = v.videoWidth
    c.height = v.videoHeight
    try {
      const highlighted = scanner.highlightPaper(v)
      const ctx = c.getContext('2d')
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.drawImage(highlighted, 0, 0, c.width, c.height)
    } catch (_) { /* jscanify иногда кидает в первые кадры — игнор */ }
  }
  rafId = requestAnimationFrame(loopOverlay)
}

const capture = () => {
  const v = videoEl.value
  if (!v || !scanner) return
  const w = v.videoWidth
  const h = v.videoHeight
  // ширина результата — в долгой стороне, в 2 раза больше
  const resultW = Math.max(w, h)
  const resultH = Math.round(resultW * 1.414) // A4
  try {
    const extracted = scanner.extractPaper(v, resultW, resultH)
    capturedCanvas = extracted
    const r = resultEl.value
    r.width = extracted.width
    r.height = extracted.height
    r.getContext('2d').drawImage(extracted, 0, 0)
    status.value = 'captured'
    if (rafId) cancelAnimationFrame(rafId)
  } catch (e) {
    errorMsg.value = 'Не удалось обрезать: ' + (e.message || e)
    status.value = 'error'
  }
}

const retake = () => {
  capturedCanvas = null
  status.value = 'ready'
  loopOverlay()
}

const uploadCaptured = async () => {
  if (!capturedCanvas) return
  status.value = 'uploading'
  try {
    const blob = await new Promise(res => capturedCanvas.toBlob(res, 'image/jpeg', 0.9))
    const base = props.fileName && props.fileName.trim()
      ? props.fileName.replace(/[^\w\-а-яё]/gi, '_')
      : `photo_${Date.now()}`
    const fd = new FormData()
    fd.append('path', props.uploadPath)
    fd.append('source', String(props.mediaSource))
    fd.append('files[]', blob, `${base}.jpg`)

    const resp = await fetch(`/api/files?action=upload&source=${encodeURIComponent(props.mediaSource)}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: fd,
    })
    const json = await resp.json()
    if (!json?.success) throw new Error(json?.message || 'Ошибка загрузки')

    // Получаем URL только что загруженного файла
    const listResp = await fetch(`/api/files?path=${encodeURIComponent(props.uploadPath)}&source=${encodeURIComponent(props.mediaSource)}`, {
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    const listJson = await listResp.json()
    const match = (listJson?.data?.files || []).find(f => f.name === `${base}.jpg`)
    const url = match?.url || `${props.uploadPath.replace(/\/$/, '')}/${base}.jpg`

    emit('fileUploaded', { url, name: `${base}.jpg` })
    close()
  } catch (e) {
    errorMsg.value = e.message || 'Ошибка загрузки'
    status.value = 'error'
  }
}

const close = () => { internalVisible.value = false }

const cleanup = () => {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
  capturedCanvas = null
  status.value = 'idle'
}

onBeforeUnmount(cleanup)
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
}
.video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  object-fit: contain;
}
.result { max-width: 100%; max-height: 100%; object-fit: contain; }
.footer { display: flex; gap: 0.5rem; justify-content: flex-end; }
</style>
