<script setup>
import { ref } from 'vue'
import Popover     from 'primevue/popover'
import Button      from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import InputText   from 'primevue/inputtext'

const props = defineProps({
  scrollHeight:   { type: String,  default: '85vh' },
  autoFitCols:    { type: Boolean, default: true },
})

const emit = defineEmits([
  'update:scrollHeight',
  'update:autoFitCols',
  'fit-columns',
  'save-local',
  'save-server',
  'reset-local',
  'reset-server',
])

const popRef = ref(null)

/** Вызывается снаружи через ref: settingsRef.value.toggle(event) */
const toggle = (e) => popRef.value?.toggle(e)

defineExpose({ toggle })
</script>

<template>
  <Popover ref="popRef">
    <div style="padding: 1rem; min-width: 300px; display:flex; flex-direction:column; gap:0.75rem;">

      <!-- Высота таблицы -->
      <div>
        <div style="font-weight:600; font-size:13px; margin-bottom:0.5rem;">
          <i class="pi pi-arrows-v" style="margin-right:4px" /> Высота таблицы
        </div>
        <InputText
          :modelValue="scrollHeight"
          @update:modelValue="emit('update:scrollHeight', $event)"
          placeholder="85vh"
          style="width:100%"
          size="small"
        />
        <small style="color:#888; font-size:11px; display:block; margin-top:3px;">
          Например: 85vh, 600px, calc(100vh - 200px)
        </small>
      </div>

      <!-- Ширина столбцов -->
      <div style="border-top:1px solid var(--p-surface-200,#eee); padding-top:0.6rem;">
        <div style="font-weight:600; font-size:13px; margin-bottom:0.5rem;">
          <i class="pi pi-arrows-h" style="margin-right:4px" /> Ширина столбцов
        </div>
        <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.6rem;">
          <ToggleSwitch
            :modelValue="autoFitCols"
            @update:modelValue="emit('update:autoFitCols', $event)"
            inputId="tan-autofit-toggle"
          />
          <label for="tan-autofit-toggle" style="cursor:pointer; font-size:13px; flex:1;">
            Авто-подгонка по контейнеру
          </label>
          <Button v-if="!autoFitCols" size="small" text icon="pi pi-arrows-h" label="Подогнать"
            @click="emit('fit-columns')" />
        </div>
        <div style="display:flex; flex-direction:column; gap:0.3rem;">
          <Button size="small" outlined icon="pi pi-save" label="Сохранить локально"
            style="justify-content:flex-start"
            @click="emit('save-local')" />
          <Button size="small" outlined icon="pi pi-cloud-upload" label="Сохранить на сервере"
            style="justify-content:flex-start"
            @click="emit('save-server')" />
          <Button size="small" outlined severity="warn" icon="pi pi-undo" label="Сбросить локальные"
            style="justify-content:flex-start"
            @click="emit('reset-local')" />
          <Button size="small" outlined severity="danger" icon="pi pi-trash" label="Сбросить серверные"
            style="justify-content:flex-start"
            @click="emit('reset-server')" />
        </div>
      </div>

    </div>
  </Popover>
</template>
