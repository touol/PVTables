<script setup>
import Button   from 'primevue/button'
import Toolbar  from 'primevue/toolbar'
import Tooltip  from 'primevue/tooltip'

// Регистрация директивы для использования в template
const vTooltip = Tooltip
import PVAutoComplete      from './PVAutoComplete.vue'
import PVMultiAutoComplete from './PVMultiAutoComplete.vue'
import PVPrintAction       from './PVPrintAction.vue'

const props = defineProps({
  headActions:        { type: Array,   default: () => [] },
  topFilters:         { type: Object,  default: () => ({}) },
  cellSelectionMode:  { type: Boolean, default: false },
  showMobileSwitch:   { type: Boolean, default: false },
  canUndo:            { type: Boolean, default: false },
  canRedo:            { type: Boolean, default: false },
  actions1:           { type: Object,  default: () => ({}) },
  table:              { type: String,  default: '' },
  filters:            { type: Object,  default: () => ({}) },
  api:                { type: Object,  default: null },
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
  'undo',
  'redo',
  'print-success',
  'print-error',
])
</script>

<template>
  <Toolbar class="p-mb-4 tan-toolbar">
    <template #start>
      <Button
        v-for="action in headActions"
        :key="action.action"
        :icon="action.icon"
        :label="action.label"
        :class="action.class"
        @click="emit('head-action', action, $event)"
      />
      <!-- Компонент печати PVPrint -->
      <PVPrintAction
        v-if="actions1 && actions1.print && actions1.print !== false"
        :table="table"
        :filters="filters"
        :api="api"
        :page-key="`pvtables-${table}`"
        @print-success="emit('print-success', $event)"
        @print-error="emit('print-error', $event)"
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

    <!-- Правый край тулбара — инструменты вида, а не действия над данными,
         поэтому весь ряд нейтральный (severity="secondary"), и только
         «Обновить» — акцентная: она единственная здесь идёт в базу.
         Тумблеры (выделение ячеек, движок) показывают включённое состояние
         акцентом — тем же, что и у всей темы. Сами инструменты —
         пастельные (акцент на мягкой заливке), как было в макете расчёта.

         Было: undo/redo/фильтры/настройки — акцентные, «Обновить» — success,
         выделение и движок — info. Пять цветов в одном ряду из шести кнопок,
         причём цвет не значил ничего: он достался от того, кто добавлял
         кнопку последним. -->
    <template #end>
      <Button icon="pi pi-undo" :disabled="!canUndo" class="tan-tool-btn"
        v-tooltip.bottom="'Отменить (Ctrl+Z)'" @click="emit('undo')" />
      <Button icon="pi pi-undo" style="transform:scaleX(-1)" :disabled="!canRedo" class="tan-tool-btn"
        v-tooltip.bottom="'Повторить (Ctrl+Y)'" @click="emit('redo')" />
      <Button icon="pi pi-check-square"
        :severity="cellSelectionMode ? undefined : 'secondary'"
        v-tooltip.bottom="'Выделение ячеек (Ctrl+Shift+S)'"
        @click="emit('toggle-cell-selection')" />
      <Button icon="pi pi-refresh"
        v-tooltip.bottom="'Обновить'" @click="emit('refresh')" />
      <Button icon="pi pi-filter-slash" class="tan-tool-btn"
        v-tooltip.bottom="'Сбросить фильтры'" @click="emit('clear')" />
      <Button icon="pi pi-cog" class="tan-tool-btn"
        v-tooltip.bottom="'Настройки'" @click="emit('settings', $event)" />
      <Button v-if="showMobileSwitch" icon="pi pi-mobile" class="tan-tool-btn"
        v-tooltip.bottom="'Мобильный вид'"
        @click="emit('switch-mobile')" />
      <!-- Кнопка переключения движка убрана: движок один (TanStack), и выбор,
           которого нет, кнопкой показывать незачем. Событие switch-engine
           и старый путь PVTableModel оставлены на месте — если движок
           когда-нибудь понадобится вернуть, вернётся и кнопка. -->
    </template>
  </Toolbar>
</template>

<style scoped>
/* Расстояние между кнопками в тулбаре таблицы */
.tan-toolbar :deep(.p-toolbar-start),
.tan-toolbar :deep(.p-toolbar-center),
.tan-toolbar :deep(.p-toolbar-end) {
  gap: 5px;
  flex-wrap: wrap;
}
</style>
