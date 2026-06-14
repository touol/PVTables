<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    modal
    header="Предыдущие версии"
    :style="{ width: '720px', maxWidth: '95vw' }"
  >
    <div v-if="loading" class="py-6 text-center text-gray-500">Загрузка…</div>

    <div v-else-if="error" class="py-6 text-center text-red-600">{{ error }}</div>

    <div v-else-if="!versions.length" class="py-6 text-center text-gray-500">
      Версий нет (история пишется в лог; срок хранения ограничен).
    </div>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="v in versions"
        :key="v.version_id"
        class="border border-gray-200 rounded-md p-3"
      >
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="text-sm">
            <span class="font-semibold">{{ formatDate(v.created_at) }}</span>
            <span class="text-gray-500"> · {{ v.user_name || ('user #' + v.user_id) }}</span>
            <span
              class="ml-2 px-1.5 py-0.5 rounded text-xs"
              :class="actionClass(v.action)"
            >{{ v.action }}</span>
          </div>
          <Button
            label="Восстановить"
            icon="pi pi-replay"
            class="p-button-sm p-button-outlined"
            :loading="restoringId === v.version_id"
            @click="restore(v)"
          />
        </div>

        <div v-if="v.changed && v.changed.length" class="text-sm">
          <div
            v-for="f in v.changed"
            :key="f"
            class="grid grid-cols-[160px_1fr] gap-2 py-0.5 border-t border-gray-100 first:border-t-0"
          >
            <div class="text-gray-600 truncate" :title="label(f)">{{ label(f) }}</div>
            <div class="min-w-0">
              <span class="line-through text-red-500 break-words">{{ fmt(v.data_before, f) }}</span>
              <span class="mx-1 text-gray-400">→</span>
              <span class="text-green-700 break-words">{{ fmt(v.data_after, f) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="text-xs text-gray-400">без изменений полей</div>
      </div>
    </div>

    <template #footer>
      <Button label="Закрыть" icon="pi pi-times" class="p-button-text" @click="$emit('update:visible', false)" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import apiCtor from './api'

const props = defineProps({
  visible: { type: Boolean, default: false },
  table:   { type: String, required: true },
  rowId:   { type: [Number, String], default: 0 },
  columns: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:visible', 'restored'])

const api = apiCtor(props.table)

const versions = ref([])
const loading = ref(false)
const error = ref('')
const restoringId = ref(null)

// Карта поле → подпись из columns
function label(field) {
  const c = props.columns.find(
    (x) => x.field === field || x.key === field || x.accessorKey === field || x.name === field
  )
  return (c && (c.header || c.title || c.label)) || field
}

function fmt(snapshot, field) {
  if (!snapshot || !(field in snapshot)) return '∅'
  const val = snapshot[field]
  if (val === null || val === undefined || val === '') return '∅'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function formatDate(s) {
  if (!s) return ''
  // 'YYYY-MM-DD HH:MM:SS' → 'DD.MM.YYYY HH:MM'
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : s
}

function actionClass(action) {
  if (action === 'create') return 'bg-green-100 text-green-700'
  if (action === 'delete') return 'bg-red-100 text-red-700'
  return 'bg-blue-100 text-blue-700'
}

async function load() {
  if (!props.rowId) return
  loading.value = true
  error.value = ''
  versions.value = []
  try {
    const res = await api.action('versions', { id: props.rowId })
    // api.action возвращает ТЕЛО ответа: { success, message, data:{versions} }
    // (axios-обёртка на всякий случай: res.data — тело)
    const body = (res && res.success !== undefined) ? res : (res && res.data) || {}
    if (body.success) {
      versions.value = (body.data && body.data.versions) || []
    } else {
      error.value = body.message || 'Не удалось загрузить версии'
    }
  } catch (e) {
    error.value = e?.message || 'Ошибка запроса'
  } finally {
    loading.value = false
  }
}

async function restore(v) {
  if (!confirm(`Вернуть значения, как было ДО правки от ${formatDate(v.created_at)}?`)) return
  restoringId.value = v.version_id
  try {
    const res = await api.action('restore_version', { id: props.rowId, version_id: v.version_id })
    const body = (res && res.success !== undefined) ? res : (res && res.data) || {}
    if (body.success) {
      emit('restored')
      emit('update:visible', false)
    } else {
      error.value = body.message || 'Не удалось восстановить'
    }
  } catch (e) {
    error.value = e?.message || 'Ошибка запроса'
  } finally {
    restoringId.value = null
  }
}

watch(
  () => [props.visible, props.rowId],
  ([vis]) => {
    if (vis) load()
  }
)
</script>
