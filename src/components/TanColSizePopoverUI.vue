<script setup>
const props = defineProps({
  openColId:    { type: String, default: null },
  popoverPos:   { type: Object, default: () => ({ top: 0, left: 0 }) },
  columnLabel:  { type: String, default: '' },
  currentWidth: { type: Number, default: 100 },
  minSize:      { type: Number, default: 40 },
  maxSize:      { type: Number, default: 1000 },
})
const emit = defineEmits(['update:width', 'close'])

const onInput = (v) => {
  const n = Number(v)
  if (!isNaN(n)) emit('update:width', Math.max(props.minSize, Math.min(props.maxSize, n)))
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="openColId"
      class="tan-colsize-popover"
      :style="{ top: popoverPos.top + 'px', left: popoverPos.left + 'px' }"
      @keydown.esc="emit('close')"
      @click.stop
    >
      <div class="tan-colsize-popover-inner">
        <div class="tan-colsize-popover-label">
          <i class="pi pi-arrows-h" /> {{ columnLabel || openColId }}
        </div>
        <div class="tan-colsize-popover-controls">
          <input
            type="range"
            class="tan-colsize-slider"
            :min="minSize"
            :max="maxSize"
            :value="currentWidth"
            @input="onInput($event.target.value)"
          />
          <input
            type="number"
            class="tan-colsize-input"
            :min="minSize"
            :max="maxSize"
            :value="currentWidth"
            @input="onInput($event.target.value)"
          />
          <span class="tan-colsize-suffix">px</span>
        </div>
        <div class="tan-colsize-popover-actions">
          <button class="tan-colsize-btn-close" @click="emit('close')">
            <i class="pi pi-times" /> Закрыть
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tan-colsize-popover {
  position: fixed;
  z-index: 9999;
  min-width: 260px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.15);
  padding: 0;
}
.tan-colsize-popover-inner {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tan-colsize-popover-label {
  font-weight: 600;
  font-size: 13px;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tan-colsize-popover-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tan-colsize-slider {
  flex: 1;
  cursor: pointer;
}
.tan-colsize-input {
  width: 70px;
  padding: 4px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 13px;
  text-align: right;
}
.tan-colsize-suffix {
  font-size: 12px;
  color: #64748b;
}
.tan-colsize-popover-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
.tan-colsize-btn-close {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.tan-colsize-btn-close:hover { background: #e2e8f0; }
</style>
