<template>
  <div
    class="tan-mobile-card"
    :class="{ 'tan-mobile-card--selected': selected }"
    :ref="el => emit('card-el', el)"
  >
    <!-- Кастомный Vue-шаблон из конфига -->
    <template v-if="tplComponent">
      <component
        :is="tplComponent"
        :row="row"
        :cols="cols"
        :selectSettings="selectSettings"
      />
    </template>

    <!-- Авто-карточка -->
    <template v-else>

      <!-- Верхняя строка: чекбокс + title + badge -->
      <div class="tan-mc-header">
        <Checkbox
          v-if="selectable"
          :modelValue="selected"
          binary
          class="tan-mc-checkbox"
          @update:modelValue="emit('toggle-select')"
          @click.stop
        />
        <div class="tan-mc-title" @click="emit('edit')">
          {{ titleValue || '—' }}
        </div>
        <span
          v-if="badge"
          class="tan-mc-badge"
          :style="badge.color ? `background:${badge.color};color:#fff` : ''"
        >{{ badge.label }}</span>
      </div>

      <!-- Подзаголовок -->
      <div v-if="subtitleParts.length" class="tan-mc-subtitle">
        {{ subtitleParts.join(' · ') }}
      </div>

      <!-- Артикул (кастомный Vue-шаблон из mobile_card.article) -->
      <div v-if="articleComponent" class="tan-mc-article">
        <component :is="articleComponent" :row="row" :cols="cols" :selectSettings="selectSettings" />
      </div>

      <!-- Метрики (числовые поля) -->
      <div v-if="metrics.length" class="tan-mc-metrics">
        <div v-for="m in metrics" :key="m.field" class="tan-mc-metric">
          <div class="tan-mc-metric-val">{{ m.value }}</div>
          <div class="tan-mc-metric-lbl">{{ m.label }}</div>
        </div>
      </div>

      <!-- Аккордеон: подробности -->
      <div v-if="bodyFields.length" class="tan-mc-details">
        <button class="tan-mc-details-toggle" @click="detailsExpanded = !detailsExpanded">
          <i :class="detailsExpanded ? 'pi pi-angle-up' : 'pi pi-angle-down'" />
          {{ detailsExpanded ? 'Скрыть' : 'Подробнее' }}
        </button>
        <div v-if="detailsExpanded" class="tan-mc-details-body">
          <div v-for="f in bodyFields" :key="f.field" class="tan-mc-detail-row">
            <span class="tan-mc-detail-lbl">{{ f.label }}</span>
            <span class="tan-mc-detail-val">{{ cellText(f, row[f.field]) }}</span>
          </div>
        </div>
      </div>

    </template>

    <!-- Нижняя панель: действия -->
    <div v-if="expandable || rowActions.length || speedDialEnabled" class="tan-mc-footer">
      <template v-for="action in rowActions" :key="action.action || action.label">
        <!-- Скомпилированный шаблон кнопки -->
        <component
          v-if="action.compiledTemplate"
          :is="action.compiledTemplate"
          :data="row"
          :columns="cols"
          :table="table"
          :filters="filters"
          :action="action"
          @action-click="emit('action', action)"
        />
        <!-- Обычная кнопка -->
        <button
          v-else
          class="tan-action-btn"
          :class="action.class"
          :title="action.label || ''"
          @click.stop="emit('action', action)"
        >
          <i :class="action.icon || 'pi pi-cog'" />
        </button>
      </template>

      <!-- SpeedDial (menu: 1 actions) -->
      <PVTablesSplitButton
        v-if="speedDialEnabled && Object.keys(menuActions).length"
        :actions="menuActions"
        @pvtables-menu-action="emit('menu-action', $event)"
      />

      <!-- Раскрыть дочерние строки -->
      <button
        v-if="expandable"
        class="tan-action-btn"
        :title="expanded ? 'Свернуть' : 'Раскрыть'"
        @click.stop="emit('toggle-expand')"
      >
        <i :class="expanded ? 'pi pi-angle-up' : 'pi pi-angle-down'" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Checkbox from 'primevue/checkbox'
import PVTablesSplitButton from './PVTablesSplitButton.vue'
import { renderCellText, getSelectBadge } from '../composables/useCellRenderer'

const props = defineProps({
  row:             { type: Object,  required: true },
  cols:            { type: Array,   default: () => [] },
  cardRoles:       { type: Object,  default: () => ({}) },
  tplComponent:    { type: Object,  default: null },
  articleComponent:{ type: Object,  default: null },
  rowActions:      { type: Array,   default: () => [] },
  menuActions:     { type: Object,  default: () => ({}) },
  speedDialEnabled:{ type: Boolean, default: false },
  table:           { type: String,  default: '' },
  filters:         { default: null },
  selectSettings:  { type: Object,  default: () => ({}) },
  acMaps:          { type: Object,  default: () => ({}) },
  acFullMaps:      { type: Object,  default: () => ({}) },
  selectMaps:      { type: Object,  default: () => ({}) },
  customFields:    { type: Object,  default: () => ({}) },
  selected:        { type: Boolean, default: false },
  selectable:      { type: Boolean, default: false },
  expandable:      { type: Boolean, default: false },
  expanded:        { type: Boolean, default: false },
})

const emit = defineEmits(['action', 'menu-action', 'edit', 'toggle-select', 'toggle-expand', 'card-el'])

const detailsExpanded = ref(false)

const { titleField, badgeField, subtitleFields, metricFields, bodyFields: bodyFieldsList } = computed(() => props.cardRoles).value

// Переопределяем через геттеры чтобы быть реактивными
const roles = computed(() => props.cardRoles)

function cellText(col, value) {
  return renderCellText(
    col, value, props.row,
    props.acMaps, props.acFullMaps, props.selectMaps,
    props.customFields[props.row?.id] ?? {}
  )
}

const titleValue = computed(() => {
  const f = roles.value.titleField
  return f ? cellText(f, props.row[f.field]) : ''
})

const badge = computed(() => {
  const f = roles.value.badgeField
  if (!f) return null
  return getSelectBadge(f, props.row[f.field], props.selectSettings)
})

const subtitleParts = computed(() => {
  return (roles.value.subtitleFields ?? [])
    .map(f => cellText(f, props.row[f.field]))
    .filter(Boolean)
})

const metrics = computed(() => {
  return (roles.value.metricFields ?? []).map(f => ({
    field: f.field,
    label: f.label || f.field,
    value: cellText(f, props.row[f.field]),
  }))
})

const bodyFields = computed(() => roles.value.bodyFields ?? [])
</script>

<style scoped>
.tan-mobile-card {
  background: var(--p-surface-0, #fff);
  border: 1px solid var(--p-surface-200, #e5e7eb);
  border-radius: 8px;
  padding: 10px 12px 6px;
  margin-bottom: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
  transition: border-color .15s;
}
.tan-mobile-card--selected {
  border-color: var(--p-primary-500, #6366f1);
  background: var(--p-primary-50, #eef2ff);
}

/* Header */
.tan-mc-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 2px;
}
.tan-mc-checkbox { flex-shrink: 0; margin-top: 2px; }
.tan-mc-title {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.3;
  cursor: pointer;
  word-break: break-word;
}
.tan-mc-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  background: var(--p-surface-300, #d1d5db);
  color: #333;
  white-space: nowrap;
}

/* Article */
.tan-mc-article {
  font-size: 12px;
  color: var(--p-text-muted-color, #6b7280);
  margin-bottom: 4px;
  word-break: break-word;
}

/* Subtitle */
.tan-mc-subtitle {
  font-size: 12px;
  color: var(--p-text-muted-color, #6b7280);
  margin-bottom: 6px;
  padding-left: 0;
}

/* Metrics */
.tan-mc-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}
.tan-mc-metric {
  flex: 1;
  min-width: 70px;
  border: 1px solid var(--p-surface-200, #e5e7eb);
  border-radius: 6px;
  padding: 4px 6px;
  text-align: center;
}
.tan-mc-metric-val {
  font-weight: 600;
  font-size: 13px;
}
.tan-mc-metric-lbl {
  font-size: 10px;
  color: var(--p-text-muted-color, #9ca3af);
  margin-top: 1px;
}

/* Details accordion */
.tan-mc-details-toggle {
  background: none;
  border: none;
  padding: 2px 0;
  font-size: 12px;
  color: var(--p-primary-500, #6366f1);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.tan-mc-details-body {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--p-surface-100, #f3f4f6);
}
.tan-mc-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
  font-size: 12px;
}
.tan-mc-detail-lbl {
  color: var(--p-text-muted-color, #6b7280);
  flex-shrink: 0;
}
.tan-mc-detail-val {
  text-align: right;
  word-break: break-word;
}

/* Footer actions */
.tan-mc-footer {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--p-surface-100, #f3f4f6);
}
</style>
