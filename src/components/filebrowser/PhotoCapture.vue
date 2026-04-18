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
      <div v-if="status === 'idle' || status === 'loading-camera'" class="notice">
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
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import Dialog from 'primevue/dialog'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mediaSource: { type: [Number, String], default: 1 },
  uploadPath: { type: String, default: '/' },
  fileName: { type: String, default: '' },
})

const emit = defineEmits(['update:visible', 'fileUploaded'])

const internalVisible = ref(props.visible)
const status   = ref('idle') // idle | loading-camera | ready | captured | uploading | error
const errorMsg = ref('')
const videoEl  = ref(null)
const resultEl = ref(null)

let stream = null
let capturedCanvas = null

watch(() => props.visible, v => {
  internalVisible.value = v
  if (v) start()
})
watch(internalVisible, v => {
  emit('update:visible', v)
  if (!v) cleanup()
})

const start = async () => {
  try {
    errorMsg.value = ''
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
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

    // TODO: remove diagnostics — временные логи для отладки ограничений камеры
    try {
      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {}
      console.log('[PhotoCapture] трек settings', settings)
      console.log('[PhotoCapture] трек capabilities', caps)
      if (caps.width?.max && (settings.width || 0) < caps.width.max) {
        try {
          await track.applyConstraints({
            width:  { ideal: caps.width.max },
            height: { ideal: caps.height?.max || settings.height },
          })
          console.log('[PhotoCapture] после applyConstraints', track.getSettings())
        } catch (e) { console.warn('[PhotoCapture] applyConstraints failed', e) }
      }
    } catch (e) { console.warn('[PhotoCapture] diagnostics', e) }

    status.value = 'ready'
  } catch (e) {
    console.error(e)
    errorMsg.value = e.message || 'Неизвестная ошибка'
    status.value = 'error'
  }
}

const drawToResult = (source, w, h) => {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(source, 0, 0, w, h)
  capturedCanvas = canvas
  const r = resultEl.value
  r.width = w
  r.height = h
  r.getContext('2d').drawImage(canvas, 0, 0)
  status.value = 'captured'
}

const capture = async () => {
  const v = videoEl.value
  if (!v || !stream) return
  try {
    // ImageCapture использует полное разрешение матрицы (до десятков МП),
    // а не 720/1080 с превью.
    if (typeof window.ImageCapture === 'function') {
      const track = stream.getVideoTracks()[0]
      if (track) {
        try {
          const capturer = new window.ImageCapture(track)
          const caps = typeof capturer.getPhotoCapabilities === 'function'
            ? await capturer.getPhotoCapabilities().catch(() => null)
            : null
          const settings = {}
          if (caps?.imageWidth?.max)  settings.imageWidth  = caps.imageWidth.max
          if (caps?.imageHeight?.max) settings.imageHeight = caps.imageHeight.max
          const blob = await capturer.takePhoto(Object.keys(settings).length ? settings : undefined)
          const bmp = await createImageBitmap(blob)
          drawToResult(bmp, bmp.width, bmp.height)
          return
        } catch (e) {
          console.warn('[PhotoCapture] ImageCapture не сработал, fallback на canvas', e)
        }
      }
    }
    // Fallback — кадр из <video> в размере превью
    drawToResult(v, v.videoWidth, v.videoHeight)
  } catch (e) {
    errorMsg.value = e.message || String(e)
    status.value = 'error'
  }
}

const retake = () => {
  capturedCanvas = null
  status.value = 'ready'
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
    fd.append('file', blob, `${base}.jpg`)

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
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
  capturedCanvas = null
  status.value = 'idle'
}

onMounted(() => {
  if (props.visible) start()
})

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
.video { max-width: 100%; max-height: 100%; object-fit: contain; }
.result { max-width: 100%; max-height: 100%; object-fit: contain; }
.footer { display: flex; gap: 0.5rem; justify-content: flex-end; }
</style>
