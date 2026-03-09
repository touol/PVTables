<template>
  <div class="tan-edit-cell" @click.stop @dblclick.stop>

    <!-- boolean — чекбокс, contenteditable не применим -->
    <input
      v-if="col.type === 'boolean'"
      ref="divRef"
      type="checkbox"
      :checked="boolValue"
      class="tan-edit-checkbox"
      @change="onBoolChange"
      @blur="onBlur"
      @keydown="onKeydown"
    />

    <!-- все остальные типы — contenteditable div -->
    <div
      v-else
      ref="divRef"
      contenteditable="true"
      class="tan-edit-div"
      :class="{ 'tan-edit-invalid': !valid }"
      @keydown="onKeydown"
      @input="onInput"
      @blur="onBlur"
    />

  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'

const props = defineProps({
  col:          { type: Object, required: true },
  initialValue: { default: '' },
})

const emit = defineEmits(['save', 'cancel', 'navigate'])

// ── initial text displayed in the div ─────────────────────────────────────
const displayText = computed(() => {
  const v = props.initialValue
  if (v === null || v === undefined) return ''
  return String(v)
})

// ── boolean state ──────────────────────────────────────────────────────────
const boolValue = ref(props.initialValue == 1 || props.initialValue === true)

// ── validation ─────────────────────────────────────────────────────────────
const valid = ref(true)

const validate = (text) => {
  const t = text.trim()
  if (props.col.type === 'number') return t === '' || /^-?\d+$/.test(t)
  if (props.col.type === 'decimal') return t === '' || /^-?\d*[.,]?\d*$/.test(t)
  if (props.col.type === 'date') return t === '' || /^\d{4}-\d{2}-\d{2}$/.test(t) || /^\d{2}\.\d{2}\.\d{4}$/.test(t)
  return true
}

// ── block invalid keystrokes for numeric types ─────────────────────────────
const numericAllowed = (e, allowDot) => {
  const allowed = new Set(['Backspace','Delete','ArrowLeft','ArrowRight','Home','End','Tab','Escape','Enter','a','c','v','x'])
  if (allowed.has(e.key)) return true
  if ((e.ctrlKey || e.metaKey) && allowed.has(e.key.toLowerCase())) return true
  if (e.key === '-' && allowDot) return true  // allow minus
  if (allowDot && (e.key === '.' || e.key === ',')) return true
  return /^\d$/.test(e.key)
}

// ── mount: set content and focus ──────────────────────────────────────────
const divRef = ref(null)
let saved = false

onMounted(() => {
  nextTick(() => {
    const el = divRef.value
    if (!el) return
    if (props.col.type !== 'boolean') {
      el.textContent = displayText.value
    }
    el.focus?.()
    // Select all text
    if (props.col.type !== 'boolean' && el.textContent) {
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  })
})

// ── parse typed text to correct JS type ──────────────────────────────────
const parseValue = (text) => {
  const t = text.trim()
  if (props.col.type === 'number') return t === '' ? null : (parseInt(t, 10) || 0)
  if (props.col.type === 'decimal') {
    const norm = t.replace(',', '.')
    return norm === '' ? null : (parseFloat(norm) || 0)
  }
  return t
}

// ── events ────────────────────────────────────────────────────────────────
const onInput = (e) => {
  valid.value = validate(e.target.textContent)
}

const onBoolChange = (e) => {
  boolValue.value = e.target.checked
  onSave()
}

const onSave = () => {
  if (saved) return
  saved = true
  if (props.col.type === 'boolean') {
    emit('save', boolValue.value ? 1 : 0)
    return
  }
  const text = divRef.value?.textContent ?? ''
  if (!validate(text)) {
    saved = false  // allow retry
    valid.value = false
    return
  }
  emit('save', parseValue(text))
}

const onBlur = () => {
  if (!saved) onSave()
}

const onKeydown = (e) => {
  // ── Навигационные клавиши — всегда в приоритете ────────────────────────
  if (e.key === 'Escape') {
    saved = true
    emit('cancel')
    e.preventDefault()
    return
  }
  if (e.key === 'Enter' && props.col.type !== 'textarea') {
    onSave()
    emit('navigate', e.shiftKey ? 'prev-row' : 'next-row')
    e.preventDefault()
    return
  }
  if (e.key === 'Tab') {
    onSave()
    emit('navigate', e.shiftKey ? 'prev-col' : 'next-col')
    e.preventDefault()
    return
  }
  // ArrowDown/Up — переход по строкам для всех типов
  if (e.key === 'ArrowDown') { onSave(); emit('navigate', 'next-row'); e.preventDefault(); return }
  if (e.key === 'ArrowUp')   { onSave(); emit('navigate', 'prev-row'); e.preventDefault(); return }
  // ArrowLeft/Right — для text/view/textarea двигают курсор внутри, для остальных переходят по колонкам
  if (e.key === 'ArrowLeft' && props.col.type !== 'text' && props.col.type !== 'view' && props.col.type !== 'textarea') {
    onSave(); emit('navigate', 'prev-col'); e.preventDefault(); return
  }
  if (e.key === 'ArrowRight' && props.col.type !== 'text' && props.col.type !== 'view' && props.col.type !== 'textarea') {
    onSave(); emit('navigate', 'next-col'); e.preventDefault(); return
  }

  // ── Блокировка недопустимых символов для числовых типов ───────────────
  if (props.col.type === 'number'  && !numericAllowed(e, false)) { e.preventDefault(); return }
  if (props.col.type === 'decimal' && !numericAllowed(e, true))  { e.preventDefault(); return }
}
</script>
