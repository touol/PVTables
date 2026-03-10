<template>
  <div class="tan-edit-cell" @click.stop>

    <!-- boolean — чекбокс -->
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

    <!-- select / autocomplete — contenteditable + Teleport dropdown -->
    <template v-else-if="isDropdownType">
      <div
        ref="divRef"
        contenteditable="true"
        class="tan-edit-div"
        @keydown="onKeydown"
        @input="onDropdownInput"
        @focus="onDropdownFocus"
        @blur="onBlur"
      />
      <Teleport to="body">
        <div
          v-if="popoverOpen"
          class="tan-dropdown-overlay"
          :style="dropdownStyle"
          @mousedown.prevent
        >
          <div class="tan-options-list">
            <div v-if="optionsLoading" class="tan-option-empty">...</div>
            <template v-else>
              <div
                v-for="(opt, i) in dropdownOptions"
                :key="opt.id"
                class="tan-option-item"
                :class="{ 'tan-option-active': i === activeIdx }"
                @click="selectOption(opt)"
              >{{ opt.content }}</div>
              <div v-if="dropdownOptions.length === 0" class="tan-option-empty">Не найдено</div>
            </template>
          </div>
        </div>
      </Teleport>
    </template>

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
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import apiCtor from './api'

const props = defineProps({
  col:              { type: Object, required: true },
  initialValue:     { default: '' },
  selectSettings:   { type: Object, default: () => ({}) },
})

const emit = defineEmits(['save', 'cancel', 'navigate'])

// ── types ──────────────────────────────────────────────────────────────────
const isDropdownType = computed(() => props.col.type === 'select' || props.col.type === 'autocomplete')

// ── initial display text ───────────────────────────────────────────────────
const displayText = computed(() => {
  const v = props.initialValue
  if (v === null || v === undefined) return ''
  if (props.col.type === 'select') {
    const rows = props.selectSettings?.[props.col.field]?.rows
      ?? props.col.select_data
      ?? props.col.rows
    if (rows) {
      const found = rows.find(o => String(o.id) === String(v))
      if (found) return found.content
    }
  }
  return String(v)
})

// ── boolean state ──────────────────────────────────────────────────────────
const boolValue = ref(props.initialValue == 1 || props.initialValue === true)

// ── validation (для обычных типов) ─────────────────────────────────────────
const valid = ref(true)

const validate = (text) => {
  const t = text.trim()
  if (props.col.type === 'number')  return t === '' || /^-?\d+$/.test(t)
  if (props.col.type === 'decimal') return t === '' || /^-?\d*[.,]?\d*$/.test(t)
  if (props.col.type === 'date')    return t === '' || /^\d{4}-\d{2}-\d{2}$/.test(t) || /^\d{2}\.\d{2}\.\d{4}$/.test(t)
  return true
}

// ── block invalid keystrokes for numeric types ─────────────────────────────
const numericAllowed = (e, allowDot) => {
  const allowed = new Set(['Backspace','Delete','ArrowLeft','ArrowRight','Home','End','Tab','Escape','Enter','a','c','v','x'])
  if (allowed.has(e.key)) return true
  if ((e.ctrlKey || e.metaKey) && allowed.has(e.key.toLowerCase())) return true
  if (e.key === '-' && allowDot) return true
  if (allowDot && (e.key === '.' || e.key === ',')) return true
  return /^\d$/.test(e.key)
}

// ── dropdown state ─────────────────────────────────────────────────────────
const dropdownOptions  = ref([])
const optionsLoading   = ref(false)
const activeIdx        = ref(-1)
const popoverOpen      = ref(false)
const dropdownStyle    = ref({})
let   selectedId       = null   // ID выбранной опции
let   acDebounce       = null

const acApi = computed(() => {
  if (props.col.type === 'autocomplete' && props.col.table) return apiCtor(props.col.table)
  return null
})

const showOptionsPopover = () => {
  if (!divRef.value) return
  const rect = divRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: rect.bottom + 2 + 'px',
    left: rect.left + 'px',
    minWidth: Math.max(rect.width, 180) + 'px',
    zIndex: 9999,
  }
  popoverOpen.value = true
}

const hideOptionsPopover = () => {
  popoverOpen.value = false
  activeIdx.value = -1
}

const loadSelectOptions = (query) => {
  const rows = props.selectSettings?.[props.col.field]?.rows
    ?? props.col.select_data
    ?? props.col.rows
    ?? []
  const q = query.trim()
  if (!q) { dropdownOptions.value = rows; return }
  const isNum    = /^\d+$/.test(q)
  const qLower   = q.toLowerCase()
  const showId   = props.col.show_id
  dropdownOptions.value = rows.filter(o => {
    if (String(o.content).toLowerCase().includes(qLower)) return true
    if (isNum) {
      if (String(o.id) === q) return true
      if (showId && String(o[showId]) === q) return true
    }
    return false
  })
}

const loadAutocompleteOptions = async (query) => {
  if (!acApi.value) return
  optionsLoading.value = true
  try {
    const params = {
      query,
      parent:  props.col.parent,
      ids:     props.col.ids,
      limit:   20,
      offset:  0,
    }
    if (/^\d+$/.test(query.trim()) && props.col.show_id) {
      params.show_id = props.col.show_id
      params.by_id   = 1
    }
    const res = await acApi.value.autocomplete(params)
    dropdownOptions.value = res?.data?.rows ?? []
  } catch {
    dropdownOptions.value = []
  } finally {
    optionsLoading.value = false
  }
}

const onDropdownFocus = () => {
  if (props.col.type === 'select') {
    loadSelectOptions('')
    if (dropdownOptions.value.length > 0) showOptionsPopover()
  }
}

const onDropdownInput = () => {
  const text = divRef.value?.textContent ?? ''
  selectedId = null
  activeIdx.value = -1

  if (props.col.type === 'select') {
    loadSelectOptions(text)
    if (dropdownOptions.value.length > 0) showOptionsPopover()
    else hideOptionsPopover()
    return
  }

  // autocomplete — debounce
  clearTimeout(acDebounce)
  if (text.trim() === '') {
    dropdownOptions.value = []
    hideOptionsPopover()
    return
  }
  acDebounce = setTimeout(async () => {
    await loadAutocompleteOptions(text)
    if (dropdownOptions.value.length > 0) showOptionsPopover()
    else hideOptionsPopover()
  }, 250)
}

const selectOption = (opt) => {
  selectedId = opt.id
  if (divRef.value) divRef.value.textContent = opt.content
  hideOptionsPopover()
  onSave()
}

// ── mount ──────────────────────────────────────────────────────────────────
const divRef = ref(null)
let saved     = false
let unmounting = false

onBeforeUnmount(() => {
  unmounting = true
  clearTimeout(acDebounce)
  hideOptionsPopover()
})

onMounted(() => {
  const el = divRef.value
  if (el && props.col.type !== 'boolean') {
    el.textContent = displayText.value
  }
  nextTick(() => {
    const el = divRef.value
    if (!el) return
    el.focus?.()
    if (props.col.type !== 'boolean' && el.textContent) {
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  })
})

// ── parse typed text to correct JS type ───────────────────────────────────
const parseValue = (text) => {
  const t = text.trim()
  if (props.col.type === 'number')  return t === '' ? null : (parseInt(t, 10) || 0)
  if (props.col.type === 'decimal') {
    const norm = t.replace(',', '.')
    return norm === '' ? null : (parseFloat(norm) || 0)
  }
  return t
}

// ── events ─────────────────────────────────────────────────────────────────
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
  if (isDropdownType.value) {
    const text = divRef.value?.textContent?.trim() ?? ''
    if (selectedId !== null) {
      emit('save', selectedId)
    } else if (text === '') {
      emit('save', null)
    } else {
      // Ничего не выбрано — отмена
      emit('cancel')
    }
    return
  }
  const text = divRef.value?.textContent ?? ''
  if (!validate(text)) {
    saved = false
    valid.value = false
    return
  }
  emit('save', parseValue(text))
}

const onBlur = () => {
  // @mousedown.prevent на dropdown предотвращает blur при клике по опции —
  // поэтому blur = реальный уход фокуса наружу
  hideOptionsPopover()
  if (!saved && !unmounting) onSave()
}

const onKeydown = (e) => {
  // ── Dropdown-специфичная навигация (когда попавер открыт) ───────────────
  if (isDropdownType.value && popoverOpen.value) {
    if (e.key === 'ArrowDown') {
      activeIdx.value = Math.min(activeIdx.value + 1, dropdownOptions.value.length - 1)
      e.preventDefault(); return
    }
    if (e.key === 'ArrowUp') {
      activeIdx.value = Math.max(activeIdx.value - 1, 0)
      e.preventDefault(); return
    }
    if (e.key === 'Enter') {
      if (activeIdx.value >= 0 && dropdownOptions.value[activeIdx.value]) {
        selectOption(dropdownOptions.value[activeIdx.value])
        emit('navigate', 'next-row')
      }
      e.preventDefault(); return
    }
    if (e.key === 'Escape') {
      hideOptionsPopover()
      e.preventDefault(); return
    }
  }

  // ── Общие навигационные клавиши ────────────────────────────────────────
  if (e.key === 'Escape') {
    saved = true
    emit('cancel')
    e.preventDefault(); return
  }
  if (e.key === 'Enter' && props.col.type !== 'textarea') {
    const dir = e.shiftKey ? 'prev-row' : 'next-row'
    onSave(); emit('navigate', dir)
    e.preventDefault(); e.stopPropagation(); return
  }
  if (e.key === 'Tab') {
    const dir = e.shiftKey ? 'prev-col' : 'next-col'
    onSave(); emit('navigate', dir)
    e.preventDefault(); e.stopPropagation(); return
  }
  if (e.key === 'ArrowDown') { onSave(); emit('navigate', 'next-row'); e.preventDefault(); return }
  if (e.key === 'ArrowUp')   { onSave(); emit('navigate', 'prev-row'); e.preventDefault(); return }
  if (e.key === 'ArrowLeft') { onSave(); emit('navigate', 'prev-col'); e.preventDefault(); return }
  if (e.key === 'ArrowRight'){ onSave(); emit('navigate', 'next-col'); e.preventDefault(); return }

  // ── Блокировка недопустимых символов ──────────────────────────────────
  if (props.col.type === 'number'  && !numericAllowed(e, false)) { e.preventDefault(); return }
  if (props.col.type === 'decimal' && !numericAllowed(e, true))  { e.preventDefault(); return }
}
</script>
