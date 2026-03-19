<script setup>
import Button   from 'primevue/button'
import Toolbar  from 'primevue/toolbar'
import Tooltip  from 'primevue/tooltip'

// Регистрация директивы для использования в template
const vTooltip = Tooltip
import PVAutoComplete      from './PVAutoComplete.vue'
import PVMultiAutoComplete from './PVMultiAutoComplete.vue'

const props = defineProps({
  headActions:        { type: Array,   default: () => [] },
  topFilters:         { type: Object,  default: () => ({}) },
  cellSelectionMode:  { type: Boolean, default: false },
  showMobileSwitch:   { type: Boolean, default: false },
})

const emit = defineEmits([
  'head-action',     // (action, event)
  'set-top-filter',  // (filter)
  'clear',
  'refresh',
  'settings',
  'switch-engine',
  'toggle-cell-selection',
  'switch-mobile',
])
</script>

<template>
  <Toolbar class="p-mb-4">
    <template #start>
      <Button
        v-for="action in headActions"
        :key="action.action"
        :icon="action.icon"
        :label="action.label"
        :class="action.class"
        @click="emit('head-action', action, $event)"
      />
    </template>

    <template #center>
      <template v-for="filter of topFilters" :key="filter.field">
        <PVAutoComplete
          v-if="filter.type === 'autocomplete'"
          :field="filter" v-model="filter.default" :options="filter.rows"
          @set-value="emit('set-top-filter', filter)"
        />
        <PVMultiAutoComplete
          v-else-if="filter.type === 'multiautocomplete'"
          :field="filter" v-model="filter.default" :options="filter.rows"
          @set-value="emit('set-top-filter', filter)"
        />
      </template>
    </template>

    <template #end>
      <Button icon="pi pi-check-square"
        :class="cellSelectionMode ? 'p-button-info' : 'p-button-secondary'"
        v-tooltip.bottom="'Выделение ячеек (Ctrl+Shift+S)'"
        @click="emit('toggle-cell-selection')" />
      <Button icon="pi pi-refresh" class="p-button-success"
        v-tooltip.bottom="'Обновить'" @click="emit('refresh')" />
      <Button icon="pi pi-filter-slash"
        v-tooltip.bottom="'Сбросить фильтры'" @click="emit('clear')" />
      <Button icon="pi pi-cog"
        v-tooltip.bottom="'Настройки'" @click="emit('settings', $event)" />
      <Button v-if="showMobileSwitch" icon="pi pi-mobile"
        v-tooltip.bottom="'Мобильный вид'"
        @click="emit('switch-mobile')" />
      <Button icon="pi pi-th-large" class="p-button-info"
        v-tooltip.bottom="'Движок: TanStack Table — нажать для PrimeVue'"
        @click="emit('switch-engine')" />
    </template>
  </Toolbar>
</template>
