<script setup>
import { ref, watch, nextTick } from 'vue'
import Button from 'primevue/button'

const props = defineProps({
  openFilterColId:  { type: String,  default: null },
  filterPopoverPos: { type: Object,  default: () => ({ top: 0, left: 0 }) },
  filterValue:      { type: String,  default: '' },
  columnLabel:      { type: String,  default: '' },
})

const emit = defineEmits([
  'update:filterValue',
  'apply',
  'close',
  'clear',
])

const inputRef = ref(null)

// Фокус при открытии
watch(() => props.openFilterColId, val => {
  if (val) nextTick(() => inputRef.value?.focus())
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="openFilterColId"
      class="tan-filter-popover"
      :style="{ top: filterPopoverPos.top + 'px', left: filterPopoverPos.left + 'px' }"
    >
      <div class="tan-filter-popover-inner">
        <label class="tan-filter-popover-label">
          <i class="pi pi-filter" />
          {{ columnLabel || openFilterColId }}
        </label>
        <input
          ref="inputRef"
          class="tan-filter-popover-input"
          type="text"
          :value="filterValue"
          placeholder="Введите значение…"
          @input="emit('update:filterValue', $event.target.value)"
          @keydown.enter="emit('apply')"
          @keydown.esc="emit('close')"
        />
        <div class="tan-filter-popover-actions">
          <Button size="small" text severity="secondary" icon="pi pi-times" label="Сбросить"
            @click="emit('clear')" />
          <Button size="small" icon="pi pi-check" label="Применить"
            @click="emit('apply')" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
