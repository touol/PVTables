<template>
  <div class="tan-edit-cell" @click.stop @dblclick.stop>
    <textarea
      v-if="col.type === 'textarea'"
      ref="inputRef"
      v-model="localValue"
      class="tan-edit-input tan-edit-textarea"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <input
      v-else-if="col.type === 'number'"
      ref="inputRef"
      type="number"
      step="1"
      v-model.number="localValue"
      class="tan-edit-input"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <input
      v-else-if="col.type === 'decimal'"
      ref="inputRef"
      type="number"
      :step="decimalStep"
      v-model.number="localValue"
      class="tan-edit-input"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <input
      v-else-if="col.type === 'date'"
      ref="inputRef"
      type="date"
      v-model="localValue"
      class="tan-edit-input"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <input
      v-else-if="col.type === 'boolean'"
      ref="inputRef"
      type="checkbox"
      v-model="localValue"
      class="tan-edit-checkbox"
      @change="onSave"
      @blur="onBlur"
    />
    <input
      v-else
      ref="inputRef"
      type="text"
      v-model="localValue"
      class="tan-edit-input"
      @keydown="onKeydown"
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

const decimalStep = computed(() => {
  const fd = props.col.FractionDigits
  return fd ? Math.pow(10, -fd) : 0.01
})

const inputRef = ref(null)
const localValue = ref(
  (props.col.type === 'number' || props.col.type === 'decimal')
    ? (props.initialValue === '' || props.initialValue == null ? null : Number(props.initialValue))
    : props.col.type === 'boolean'
      ? (props.initialValue == 1 || props.initialValue === true)
      : (props.initialValue ?? '')
)

let saved = false

onMounted(() => {
  nextTick(() => {
    inputRef.value?.focus?.()
    if (inputRef.value?.select && props.col.type !== 'boolean') inputRef.value.select()
  })
})

const onSave = () => {
  if (saved) return
  saved = true
  emit('save', localValue.value)
}

const onBlur = () => {
  if (!saved) onSave()
}

const onKeydown = (e) => {
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
  // Arrow navigation for non-text types
  if (props.col.type !== 'text' && props.col.type !== 'view' && props.col.type !== 'textarea') {
    if (e.key === 'ArrowDown') { onSave(); emit('navigate', 'next-row'); e.preventDefault(); return }
    if (e.key === 'ArrowUp')   { onSave(); emit('navigate', 'prev-row'); e.preventDefault(); return }
  }
}
</script>
