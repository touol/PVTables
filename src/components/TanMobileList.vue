<template>
  <div class="tan-mobile-list" ref="rootRef">
    <Toast />

    <!-- ── Тулбар ──────────────────────────────────────────────────────── -->
    <div class="tan-ml-toolbar" :class="{ 'tan-ml-toolbar--sticky': scrollMode === 'window' }">
      <!-- Чекбокс "выбрать все" -->
      <Checkbox
        v-if="lineItems.length > 0"
        :modelValue="allSelected ? true : (someSelected ? null : false)"
        binary
        :indeterminate="someSelected"
        class="tan-ml-select-all"
        @update:modelValue="toggleSelectAll"
      />

      <!-- Кнопка действий (выпадающее меню) -->
      <Button
        v-if="headActions.length"
        icon="pi pi-ellipsis-v"
        text
        rounded
        severity="secondary"
        title="Действия"
        @click="actionsMenuRef.toggle($event)"
      />
      <Menu ref="actionsMenuRef" :model="headActionItems" popup>
        <template #item="{ item, props: itemProps }">
          <a v-bind="itemProps.action" class="tan-ml-menu-item" :class="item.itemClass">
            <i :class="item.icon" />
            <span>{{ item.label }}</span>
          </a>
        </template>
      </Menu>

      <div class="tan-ml-toolbar-spacer" />

      <!-- Фильтры -->
      <Button
        icon="pi pi-filter"
        text
        rounded
        severity="secondary"
        @click="openFilterDrawer"
        title="Фильтры"
      >
        <template #default>
          <i class="pi pi-filter" />
          <Badge v-if="activeFilterCount > 0" :value="activeFilterCount" class="tan-ml-filter-badge" />
        </template>
      </Button>

      <!-- Переключатель в десктоп -->
      <Button
        icon="pi pi-table"
        text
        rounded
        severity="secondary"
        title="Полная таблица"
        @click="emit('switch-to-desktop')"
      />
    </div>

    <!-- ── Индикатор загрузки ──────────────────────────────────────────── -->
    <div v-if="loading" class="tan-ml-loading">
      <i class="pi pi-spin pi-spinner" /> Загрузка...
    </div>

    <!-- ── Пустой список ───────────────────────────────────────────────── -->
    <div v-else-if="lineItems.length === 0" class="tan-ml-empty">
      Нет данных
    </div>

    <!-- ── Виртуализированный список (режим A — container scroll) ─────── -->
    <div
      v-else-if="scrollMode === 'container'"
      ref="scrollContainerRef"
      class="tan-ml-scroll"
      :style="{ height: containerHeight }"
    >
      <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
        <div
          v-for="vRow in virtualizer.getVirtualItems()"
          :key="vRow.key"
          :data-index="vRow.index"
          :ref="measureEl"
          :style="{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }"
        >
          <TanMobileCard
            :row="lineItems[vRow.index]"
            :cols="columns"
            :cardRoles="cardRoles"
            :tplComponent="tplComponent"
            :articleComponent="articleComponent"
            :rowActions="rowActionsComputed"
            :menuActions="nemu_actions"
            :speedDialEnabled="speedDialEnabled"
            :table="props.table"
            :filters="filters"
            :selectSettings="selectSettings"
            :acMaps="acMaps"
            :acFullMaps="acFullMaps"
            :selectMaps="selectMaps"
            :customFields="customFields"
            :selected="selectedIds.has(lineItems[vRow.index]?.id)"
            :selectable="true"
            :expandable="hasExpandRows && lineItems[vRow.index]?.gtsapi_children_count > 0"
            :expanded="!!expandedRows[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]"
            @toggle-select="toggleSelect(lineItems[vRow.index]?.id)"
            @action="onRowAction($event, lineItems[vRow.index])"
            @menu-action="({action: actionKey}) => onMenuAction(actionKey, lineItems[vRow.index])"
            @edit="openEditDialog(lineItems[vRow.index])"
            @toggle-expand="toggleExpandRow(lineItems[vRow.index])"
          />
          <div
            v-if="expandedRows[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)] && subsData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]"
            class="tan-ml-expand-body"
          >
            <PVTables
              v-if="subsData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]?.action === 'subtables'"
              :table="subsData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)].table"
              :actions="props.actions"
              :filters="subfiltersData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]"
              :child="true"
              :auto-fit-height="true"
              :ref="el => { if (el) childComponentRefs[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)] = el }"
              @refresh-table="refresh(false)"
            />
            <PVTabs
              v-else-if="subsData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]?.action === 'subtabs'"
              :tabs="subsData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)].tabs"
              :actions="props.actions"
              :filters="subfiltersData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]"
              :child="true"
              :ref="el => { if (el) childComponentRefs[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)] = el }"
              @refresh-table="refresh(false)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ── Виртуализированный список (режим B — window scroll) ────────── -->
    <div v-else ref="windowListRef">
      <div :style="{ height: `${windowVirtualizer.getTotalSize()}px`, position: 'relative' }">
        <div
          v-for="vRow in windowVirtualizer.getVirtualItems()"
          :key="vRow.key"
          :data-index="vRow.index"
          :ref="measureWindowEl"
          :style="{
            position: 'absolute', top: 0, left: 0, width: '100%',
            transform: `translateY(${vRow.start - windowVirtualizer.options.scrollMargin}px)`
          }"
        >
          <TanMobileCard
            :row="lineItems[vRow.index]"
            :cols="columns"
            :cardRoles="cardRoles"
            :tplComponent="tplComponent"
            :articleComponent="articleComponent"
            :rowActions="rowActionsComputed"
            :menuActions="nemu_actions"
            :speedDialEnabled="speedDialEnabled"
            :table="props.table"
            :filters="filters"
            :selectSettings="selectSettings"
            :acMaps="acMaps"
            :acFullMaps="acFullMaps"
            :selectMaps="selectMaps"
            :customFields="customFields"
            :selected="selectedIds.has(lineItems[vRow.index]?.id)"
            :selectable="true"
            :expandable="hasExpandRows && lineItems[vRow.index]?.gtsapi_children_count > 0"
            :expanded="!!expandedRows[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]"
            @toggle-select="toggleSelect(lineItems[vRow.index]?.id)"
            @action="onRowAction($event, lineItems[vRow.index])"
            @menu-action="({action: actionKey}) => onMenuAction(actionKey, lineItems[vRow.index])"
            @edit="openEditDialog(lineItems[vRow.index])"
            @toggle-expand="toggleExpandRow(lineItems[vRow.index])"
          />
          <div
            v-if="expandedRows[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)] && subsData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]"
            class="tan-ml-expand-body"
          >
            <PVTables
              v-if="subsData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]?.action === 'subtables'"
              :table="subsData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)].table"
              :actions="props.actions"
              :filters="subfiltersData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]"
              :child="true"
              :auto-fit-height="true"
              :ref="el => { if (el) childComponentRefs[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)] = el }"
              @refresh-table="refresh(false)"
            />
            <PVTabs
              v-else-if="subsData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]?.action === 'subtabs'"
              :tabs="subsData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)].tabs"
              :actions="props.actions"
              :filters="subfiltersData[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)]"
              :child="true"
              :ref="el => { if (el) childComponentRefs[lineItems[vRow.index]?._rowKey || String(lineItems[vRow.index]?.id)] = el }"
              @refresh-table="refresh(false)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ── Пагинатор ───────────────────────────────────────────────────── -->
    <div v-if="!loading && totalRecords > 0" class="tan-ml-paginator">
      <Button icon="pi pi-chevron-left"  text rounded :disabled="first === 0"          @click="goPrev" />
      <span class="tan-ml-page-info">{{ currentPage }} / {{ totalPages }} · {{ totalRecords }}</span>
      <Button icon="pi pi-chevron-right" text rounded :disabled="first + currentPageSize >= totalRecords" @click="goNext" />
    </div>

    <!-- ── Floating bulk-actions ──────────────────────────────────────── -->
    <Transition name="tan-ml-bulk-slide">
      <div v-if="someSelected || allSelected" class="tan-ml-bulk-panel">
        <span class="tan-ml-bulk-count">Выбрано: {{ selectedIds.size }}</span>
        <div class="tan-ml-bulk-actions">
          <Button
            v-for="action in bulkActions"
            :key="action.label"
            :icon="action.icon"
            :label="action.label"
            size="small"
            :severity="action.class?.includes('danger') ? 'danger' : 'secondary'"
            @click="onBulkAction(action)"
          />
          <Button icon="pi pi-times" text rounded severity="secondary" @click="clearSelection" />
        </div>
      </div>
    </Transition>

    <!-- ── Фильтры Drawer ─────────────────────────────────────────────── -->
    <Drawer v-model:visible="filterDrawerVisible" position="bottom" style="height:80vh">
      <template #header>
        <div class="tan-ml-drawer-header">
          <span class="font-semibold">Фильтры</span>
          <Button label="Очистить всё" text size="small" @click="clearAllFilters" />
        </div>
      </template>

      <Accordion>
        <AccordionPanel v-for="col in filterableCols" :key="col.field" :value="col.field">
          <AccordionHeader>
            <span>{{ col.label || col.field }}</span>
            <i v-if="isFilterActive(col.field)" class="pi pi-circle-fill text-primary ml-2" style="font-size:8px" />
          </AccordionHeader>
          <AccordionContent>
            <TanFilterPopoverUI
              :inline="true"
              :openFilterColId="col.field"
              :colType="col.type"
              :colMeta="col"
              :columnLabel="col.label || col.field"
              :serverFilter="colServerFilters[col.field]"
              :matchModes="MATCH_MODES[col.type] ?? MATCH_MODES.text"
              :matchModeLabels="MATCH_MODE_LABELS"
              :operatorLabels="OPERATOR_LABELS"
              :selectOptions="colChecklistState[col.field]?.all ?? []"
              :checklistAll="colChecklistState[col.field]?.all ?? []"
              :checklistChecked="colChecklistState[col.field]?.checked"
              @apply-server="applyServerFilter(col.field)"
              @clear-all="clearColFilter(col.field)"
              @update:operator="v => updateFilterOperator(col.field, v)"
              @update:constraint-value="({idx, value}) => updateConstraintValue(col.field, idx, value)"
              @update:constraint-mode="({idx, value}) => updateConstraintMode(col.field, idx, value)"
              @add-constraint="addConstraint(col.field, col.type)"
              @remove-constraint="removeConstraint(col.field, $event)"
              @toggle-checklist="toggleChecklistValue(col.field, $event)"
              @toggle-checklist-all="toggleChecklistAll(col.field)"
            />
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </Drawer>

    <!-- ── Dialog редактирования ──────────────────────────────────────── -->
    <Dialog v-if="lineItemDialog" v-model:visible="lineItemDialog" header="Редактировать" modal style="width:95vw;max-width:480px">
      <PVForm
        v-model="lineItem"
        :columns="columns"
        :autocompleteSettings="autocompleteSettings"
        :selectSettings="selectSettings"
        :customFields="lineItem ? customFields[lineItem._rowKey] : {}"
        :mywatch="mywatch"
        :form="form"
      />
      <template #footer>
        <Button label="Отмена"    icon="pi pi-times" class="p-button-text" @click="hideDialog" />
        <Button label="Сохранить" icon="pi pi-check" class="p-button-text" @click="saveLineItem" />
      </template>
    </Dialog>

    <!-- ── Dialog удаления (одиночное) ────────────────────────────────── -->
    <Dialog v-if="deleteLineItemDialog" v-model:visible="deleteLineItemDialog" header="Подтверждение" modal>
      <div class="flex items-center gap-3">
        <i class="pi pi-exclamation-triangle text-3xl text-orange-400" />
        <span>Вы хотите удалить эту запись?</span>
      </div>
      <template #footer>
        <Button label="Нет" icon="pi pi-times" class="p-button-text" @click="deleteLineItemDialog = false" />
        <Button label="Да"  icon="pi pi-check" class="p-button-text" @click="deleteLineItem" />
      </template>
    </Dialog>

    <!-- ── Modal form dialog (action с modal_form) ──────────────────────── -->
    <Dialog v-if="modalFormDialog" v-model:visible="modalFormDialog"
      :header="modalFormAction?.action || 'Действие'" modal style="width:95vw;max-width:480px">
      <PVForm v-model="modalFormData" :columns="modalFormColumns"
        :autocompleteSettings="autocompleteSettings" :selectSettings="selectSettings" />
      <template #footer>
        <Button label="Отмена" icon="pi pi-times" class="p-button-text" @click="hideModalForm" />
        <Button
          :label="modalFormAction?.modal_form?.buttons?.submit?.label || 'Выполнить'"
          :icon="modalFormAction?.modal_form?.buttons?.submit?.icon || 'pi pi-check'"
          class="p-button-text" @click="submitModalForm"
        />
      </template>
    </Dialog>

    <!-- ── Dialog удаления (выбранные) ─────────────────────────────────── -->
    <Dialog v-if="deleteLineItemsDialog" v-model:visible="deleteLineItemsDialog" header="Подтверждение" modal>
      <div class="flex items-center gap-3">
        <i class="pi pi-exclamation-triangle text-3xl text-orange-400" />
        <span>Удалить выбранные записи ({{ selectedlineItems.length }})?</span>
      </div>
      <template #footer>
        <Button label="Нет" icon="pi pi-times" class="p-button-text" @click="deleteLineItemsDialog = false" />
        <Button label="Да"  icon="pi pi-check" class="p-button-danger" @click="doDeleteSelected" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useVirtualizer, useWindowVirtualizer } from '@tanstack/vue-virtual'

import Button  from 'primevue/button'
import Badge   from 'primevue/badge'
import Checkbox from 'primevue/checkbox'
import Menu    from 'primevue/menu'
import Drawer  from 'primevue/drawer'
import Dialog  from 'primevue/dialog'
import Accordion       from 'primevue/accordion'
import AccordionPanel  from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Toast   from 'primevue/toast'

import TanMobileCard     from './TanMobileCard.vue'
import TanFilterPopoverUI from './TanFilterPopoverUI.vue'
import PVForm            from './PVForm.vue'
import PVTables          from '../PVTables.vue'
import PVTabs            from './PVTabs.vue'

import apiCtor              from './api'
import { useNotifications } from './useNotifications'
import { usePVTableData }   from '../composables/usePVTableData'
import { usePVTableFilters } from '../composables/usePVTableFilters'
import { usePVTableActions } from '../composables/usePVTableActions'
import { useTanCRUD }       from '../composables/useTanCRUD'
import { useTanFilterPopover } from '../composables/useTanFilterPopover'
import { useMobileCardConfig } from '../composables/useMobileCardConfig'
import { usePVTableExpand }  from '../composables/usePVTableExpand'

// ─── Props ────────────────────────────────────────────────────────────────
const props = defineProps({
  table:         { type: String,  required: true },
  actions:       { type: Object,  default: () => ({}) },
  filters:       { type: Object,  default: () => ({}) },
  sorting:       { type: Array,   default: () => [] },
  child:         { type: Boolean, default: false },
  scrollHeight:  { type: String,  default: '85vh' },
  autoFitHeight: { type: Boolean, default: false },
  scrollMode:    { type: String,  default: 'container' }, // 'container' | 'window'
})

const emit = defineEmits(['get-response', 'refresh-table', 'switch-to-desktop'])

// ─── API + Notifications ──────────────────────────────────────────────────
const api = apiCtor(props.table)
const { notify } = useNotifications()

// ─── State ────────────────────────────────────────────────────────────────
const columns          = ref([])
const selectSettings   = ref({})
const mobileCardConfig = ref(null)
const fieldsRef        = ref({})
const form             = ref({})
const table_tree       = ref(null)
const dataFields       = ref([])

// ─── Expand (extended row) ────────────────────────────────────────────────
const expandComposable = usePVTableExpand(table_tree, () => filters, ref([]), props.table)
const expandedRows     = expandComposable.expandedRows
const subsData         = expandComposable.subs
const subfiltersData   = expandComposable.subfilters
const childComponentRefs = expandComposable.childComponentRefs
const hasExpandRows    = computed(() => !!table_tree.value)

function toggleExpandRow(row) {
  if (!row._rowKey) row._rowKey = String(row.id)
  if (hasExpandRows.value) {
    expandComposable.toogleExpandRow(row)
  }
}
function setExpandedRow(row, tmpt) {
  if (!row._rowKey) row._rowKey = String(row.id)
  expandComposable.setExpandedRow(row, tmpt)
}

// CRUD dialog state (refs assigned from crudComposable in onMounted)
const lineItem            = ref(null)
const lineItemDialog         = ref(false)
const deleteLineItemDialog   = ref(false)
const deleteLineItemsDialog  = ref(false)
const mywatch             = ref({ enabled: false, fields: [], filters: {}, table: '', action: '' })

const rootRef          = ref(null)
const scrollContainerRef = ref(null)
const windowListRef    = ref(null)

// ─── Data composable ──────────────────────────────────────────────────────
const {
  loading, totalRecords, first, lineItems, lazyParams,
  autocompleteSettings, dynamicSelects, row_setting, customFields,
  createLoadLazyData, createOnPage, findIndexById, updateEmptyRow,
  isEmptyRow, isEditableEmptyRow, emptyRowsState,
} = usePVTableData(0)

watch(dynamicSelects, v => {
  for (const k in v) selectSettings.value[k] = v[k]
}, { deep: true })

// ─── Lookup maps ─────────────────────────────────────────────────────────
const acMaps = computed(() => {
  const maps = {}
  for (const field in autocompleteSettings.value) {
    const rows = autocompleteSettings.value[field]?.rows
    if (rows) { const m = new Map(); rows.forEach(o => m.set(String(o.id), o.content)); maps[field] = m }
  }
  return maps
})
const acFullMaps = computed(() => {
  const maps = {}
  for (const field in autocompleteSettings.value) {
    const rows = autocompleteSettings.value[field]?.rows
    if (rows) { const m = new Map(); rows.forEach(o => m.set(String(o.id), o)); maps[field] = m }
  }
  return maps
})
const selectMaps = computed(() => {
  const maps = {}
  for (const field in selectSettings.value) {
    const rows = selectSettings.value[field]?.rows
    if (rows) { const m = new Map(); rows.forEach(o => m.set(String(o.id), o.content ?? o.label ?? '')); maps[field] = m }
  }
  return maps
})

// ─── Mobile card config ───────────────────────────────────────────────────
const { cardRoles, tplComponent, articleComponent } = useMobileCardConfig(mobileCardConfig, columns)

// ─── Filter composable ────────────────────────────────────────────────────
let loadLazyData, onPage
let filters, initFilters, prepFilters

// Watch external filters
watch(() => props.filters, () => {
  if (!loadLazyData) return
  initFilters?.()
  first.value = 0
  if (lazyParams.value) lazyParams.value.first = 0
  loadLazyData()
}, { deep: true })

// ─── Filter popover composable ────────────────────────────────────────────
const {
  openFilterColId,
  colServerFilters, colChecklistState,
  MATCH_MODES, MATCH_MODE_LABELS, OPERATOR_LABELS,
  applyServerFilter, clearColFilter, clearServerFilter,
  addConstraint, removeConstraint,
  toggleChecklistValue, toggleChecklistAll,
  isFilterActive, initColFilter,
} = useTanFilterPopover({
  filtersGetter:              () => filters,
  loadLazyDataGetter:         () => loadLazyData,
  initFiltersGetter:          () => initFilters,
  tableInstanceGetter:        () => null,
  first, lazyParams,
  lineItemsGetter:            () => lineItems.value,
  columnsGetter:              () => columns.value,
  selectSettingsGetter:       () => selectSettings.value,
  autocompleteSettingsGetter: () => autocompleteSettings.value,
  acFullMapsGetter:           () => acFullMaps.value,
  getACContentFn:             (f, v) => acMaps.value[f]?.get(String(v)) ?? '',
  getSelectContentFn:         (f, v) => selectMaps.value[f]?.get(String(v)) ?? '',
  formatDateFn:               v => v ? v.split('-').reverse().join('.') : '',
  onChecklistChange:          applyChecklistServerFilter,
})

// Серверный фильтр по чеклисту: пишем `in`-constraint прямо в colServerFilters
function applyChecklistServerFilter(colId, checkedSet, allValues) {
  if (checkedSet.size === 0 || checkedSet.size === allValues.length) {
    delete colServerFilters.value[colId]
  } else {
    colServerFilters.value[colId] = {
      operator: 'or',
      constraints: [{ value: Array.from(checkedSet), matchMode: 'in' }],
    }
  }
  applyServerFilter(colId)
}

// helper: обновление operator/constraint из TanFilterPopoverUI через events
function updateFilterOperator(colId, value) {
  if (!colServerFilters.value[colId]) return
  colServerFilters.value[colId].operator = value
}
function updateConstraintValue(colId, index, value) {
  const sf = colServerFilters.value[colId]
  if (!sf) return
  sf.constraints[index] = { ...sf.constraints[index], value }
}
function updateConstraintMode(colId, index, mode) {
  const sf = colServerFilters.value[colId]
  if (!sf) return
  sf.constraints[index] = { ...sf.constraints[index], matchMode: mode }
}

const filterableCols = computed(() =>
  columns.value.filter(c => c.type !== 'hidden' && c.type !== 'html')
)

const activeFilterCount = computed(() =>
  filterableCols.value.filter(c => isFilterActive(c.field)).length
)

function openFilterDrawer() {
  for (const col of filterableCols.value) initColFilter(col.field, col.type)
  filterDrawerVisible.value = true
}

function clearAllFilters() {
  for (const col of filterableCols.value) clearColFilter(col.field)
  filterDrawerVisible.value = false
}

// ─── Actions ──────────────────────────────────────────────────────────────
const cur_actions    = ref([])
const nemu_actions   = ref({})
const speedDialEnabled = ref(false)
const selectedlineItems = ref([])
let actionsComposable
let hideModalForm, submitModalForm

const modalFormDialog  = ref(false)
const modalFormData    = ref({})
const modalFormAction  = ref(null)
const modalFormRowData = ref(null)
const modalFormType    = ref(null)
const modalFormColumns = ref([])

const headActions = computed(() => cur_actions.value.filter(x => x.head))
const rowActionsComputed = computed(() => cur_actions.value.filter(x => x.row && x.menu !== 1))
const bulkActions = computed(() => headActions.value.filter(x => x.bulk))

const actionsMenuRef = ref(null)

const severityClassMap = {
  'p-button-success':   'tan-ml-item--success',
  'p-button-danger':    'tan-ml-item--danger',
  'p-button-warn':      'tan-ml-item--warn',
  'p-button-info':      'tan-ml-item--info',
  'p-button-secondary': 'tan-ml-item--secondary',
}

const headActionItems = computed(() =>
  headActions.value.map(a => {
    const raw = a.class?.trim() ?? ''
    const colorClass = Object.entries(severityClassMap).find(([k]) => raw.includes(k))?.[1] ?? ''
    return {
      label: a.label,
      icon:  a.icon,
      itemClass: colorClass,
      command: (e) => {
        const fn = a.head_click ?? a.click
        if (fn) fn(e.originalEvent, props.table, filters, selectedlineItems)
      },
    }
  })
)

function onHeadAction(action, event) {
  const fn = action.head_click ?? action.click
  if (fn) fn(event, props.table, filters, selectedlineItems)
}

function onRowAction(action, row) {
  if (action.click) action.click(row, columns.value, props.table, filters)
}

function onMenuAction(actionKey, row) {
  const action = nemu_actions.value?.[actionKey]
  if (action?.click) action.click(row, columns.value, props.table, filters)
}

function onBulkAction(action) {
  selectedlineItems.value = lineItems.value.filter(r => selectedIds.value.has(r.id))
  if (action.click) action.click(null, columns.value, props.table, filters)
}

// ─── Selection ────────────────────────────────────────────────────────────
const selectedIds = ref(new Set())
const allSelected = computed(() => selectedIds.value.size > 0 && selectedIds.value.size === lineItems.value.length)
const someSelected = computed(() => selectedIds.value.size > 0 && !allSelected.value)

function toggleSelect(id) {
  if (!id) return
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selectedIds.value = s
}
function toggleSelectAll() {
  if (allSelected.value) { selectedIds.value = new Set(); return }
  selectedIds.value = new Set(lineItems.value.map(r => r.id))
}
function clearSelection() { selectedIds.value = new Set() }

watch(lineItems, () => clearSelection())

// Синхронизируем Set selectedIds → массив selectedlineItems для CRUD composable
watch(selectedIds, ids => {
  selectedlineItems.value = lineItems.value.filter(r => ids.has(r.id))
}, { deep: true })

// ─── CRUD composable refs (assigned in onMounted) ─────────────────────────
let openNew, editLineItem, saveLineItem
let confirmDeleteLineItem, deleteSelectedLineItems, _deleteSelectedLineItems
let _crudHideDialog, _crudDeleteLineItem

function hideDialog() { _crudHideDialog?.() }
function deleteLineItem() { _crudDeleteLineItem?.() }
function doDeleteSelected() { _deleteSelectedLineItems?.() }

// ─── Pagination ───────────────────────────────────────────────────────────
const currentPageSize = ref(10)
const currentPage  = computed(() => currentPageSize.value > 0 ? Math.floor(first.value / currentPageSize.value) + 1 : 1)
const totalPages   = computed(() => currentPageSize.value > 0 ? Math.ceil(totalRecords.value / currentPageSize.value) : 1)

const containerHeight = computed(() => {
  if (props.autoFitHeight) return '100%'
  return props.scrollHeight || '85vh'
})

function goPrev() {
  if (first.value === 0) return
  first.value = Math.max(0, first.value - currentPageSize.value)
  onPage?.({ first: first.value, rows: currentPageSize.value })
  scrollToTop()
}
function goNext() {
  const n = first.value + currentPageSize.value
  if (n >= totalRecords.value) return
  first.value = n
  onPage?.({ first: first.value, rows: currentPageSize.value })
  scrollToTop()
}
function scrollToTop() {
  if (props.scrollMode === 'container' && scrollContainerRef.value) {
    scrollContainerRef.value.scrollTop = 0
  } else {
    window.scrollTo({ top: windowListRef.value?.offsetTop ?? 0, behavior: 'smooth' })
  }
}

// ─── Virtual scroll — режим A (container) ─────────────────────────────────
const virtualizer = useVirtualizer({
  get count() { return lineItems.value.length },
  getScrollElement: () => scrollContainerRef.value,
  estimateSize: () => 140,
  overscan: 5,
  measureElement: el => el?.getBoundingClientRect().height ?? 140,
})

function measureEl(el) {
  if (el) virtualizer.value.measureElement(el)
}

// ─── Virtual scroll — режим B (window) ────────────────────────────────────
const windowVirtualizer = useWindowVirtualizer({
  get count() { return lineItems.value.length },
  estimateSize: () => 140,
  overscan: 5,
  get scrollMargin() { return windowListRef.value?.offsetTop ?? 0 },
})

function measureWindowEl(el) {
  if (el) windowVirtualizer.value.measureElement(el)
}

// ─── Drawer ────────────────────────────────────────────────────────────────
const filterDrawerVisible = ref(false)

// ─── Menu ref ─────────────────────────────────────────────────────────────

// ─── Refresh ──────────────────────────────────────────────────────────────
const refresh = () => { loadLazyData?.(); emit('refresh-table') }

// ─── onMounted: initialize ────────────────────────────────────────────────
onMounted(async () => {
  loading.value = true
  lazyParams.value = { first: 0, rows: currentPageSize.value }

  try {
    const response = await api.options()
    if (!response.data?.fields) {
      notify('error', { detail: 'Поля таблицы не получены' })
      loading.value = false
      return
    }

    const fields = response.data.fields

    if (response.data.limit !== false && response.data.limit) {
      currentPageSize.value   = response.data.limit
      lazyParams.value.rows   = response.data.limit
    }

    // selects
    if (response.data.selects) {
      for (const k in response.data.selects) {
        if (response.data.selects[k]) selectSettings.value[k] = response.data.selects[k]
      }
    }

    // mobile_card config
    if (response.data.mobile_card) mobileCardConfig.value = response.data.mobile_card

    if (response.data.table_tree)  table_tree.value  = response.data.table_tree
    if (response.data.data_fields) dataFields.value  = response.data.data_fields

    // Parse columns
    const cols = []
    for (const field in fields) {
      fields[field].field = field
      if (!fields[field].label) fields[field].label = field
      if (!fields[field].type)  fields[field].type  = field === 'id' ? 'view' : 'text'
      fields[field].readonly = fields[field].readonly === true || fields[field].readonly == 1
      if (!selectSettings.value[field]) selectSettings.value[field] = {}
      if (fields[field].select_data) selectSettings.value[field].rows = fields[field].select_data
      cols.push(fields[field])
    }
    columns.value  = cols
    fieldsRef.value = fields

    // Filters
    let composableLoadLazyData = null
    const filtersComposable = usePVTableFilters(
      props, fields, {},
      (...args) => composableLoadLazyData?.(...args),
      ref(null), lazyParams
    )
    filters    = filtersComposable.filters
    initFilters = filtersComposable.initFilters
    prepFilters = filtersComposable.prepFilters

    loadLazyData           = createLoadLazyData(api, fields, filters, () => prepFilters(), notify, () => props.sorting)
    composableLoadLazyData = loadLazyData
    onPage                 = createOnPage(loadLazyData)
    initFilters()

    // Actions composable
    actionsComposable = usePVTableActions({
      api, props,
      prepFilters: () => prepFilters(),
      refresh, notify, emit,
      dataFields,
      selectedlineItems,
      table_tree,
      filters: () => filters,
      modalFormDialog, modalFormData,
      modalFormAction, modalFormRowData,
      modalFormType, modalFormColumns,
    })
    hideModalForm   = actionsComposable.hideModalForm
    submitModalForm = actionsComposable.submitModalForm

    // CRUD composable — передаём наши refs чтобы диалог работал напрямую
    const crudComposable = useTanCRUD(
      api, () => prepFilters(), notify, refresh, emit, props,
      lineItems, findIndexById, customFields, row_setting, table_tree,
      ref({}), ref({}),
      { updateEmptyRow, isEmptyRow, isEditableEmptyRow, emptyRowsState },
      selectedlineItems, fieldsRef, ref(null)
    )
    openNew                 = crudComposable.openNew
    editLineItem            = crudComposable.editLineItem
    saveLineItem            = crudComposable.saveLineItem
    confirmDeleteLineItem   = crudComposable.confirmDeleteLineItem
    deleteSelectedLineItems = crudComposable.deleteSelectedLineItems
    _crudHideDialog         = crudComposable.hideDialog
    _crudDeleteLineItem       = crudComposable.deleteLineItem
    _deleteSelectedLineItems  = crudComposable.deleteSelectedLineItems

    // Синхронизируем CRUD refs с нашими reactive refs в template (двусторонне)
    watch(crudComposable.lineItem,             v => { lineItem.value = v }, { deep: true })
    watch(crudComposable.lineItemDialog,       v => { lineItemDialog.value = v })
    watch(crudComposable.deleteLineItemDialog, v => { deleteLineItemDialog.value = v })
    watch(crudComposable.deleteLineItemsDialog,v => { deleteLineItemsDialog.value = v })
    // Обратная синхронизация: PVForm обновляет lineItem → передаём в composable для saveLineItem
    watch(lineItem, v => {
      if (v && crudComposable.lineItem && crudComposable.lineItem.value !== v) {
        crudComposable.lineItem.value = v
      }
    }, { deep: true })
    watch(lineItemDialog,        v => { if (!v) crudComposable.lineItemDialog.value = false })
    watch(deleteLineItemDialog,  v => { if (!v) crudComposable.deleteLineItemDialog.value = false })
    watch(deleteLineItemsDialog, v => { if (!v) crudComposable.deleteLineItemsDialog.value = false })
    if (crudComposable.mywatch) mywatch.value = crudComposable.mywatch.value

    if (response.data.form) form.value = response.data.form

    // Process actions from server + props
    const processed = actionsComposable.processActions(
      response.data.actions, props.actions,
      {
        editLineItem: crudComposable.editLineItem,
        confirmDeleteLineItem: crudComposable.confirmDeleteLineItem,
        confirmDeleteSelected: crudComposable.confirmDeleteSelected,
        openNew: crudComposable.openNew,
        Insert: crudComposable.Insert,
        Insert_child: crudComposable.Insert_child,
        setExpandedRow,
      }
    )
    cur_actions.value    = processed.cur_actions
    nemu_actions.value   = processed.nemu_actions
    speedDialEnabled.value = processed.SpeedDialEnabled

    await loadLazyData()
  } catch (e) {
    console.error('[TanMobileList]', e)
    notify('error', { detail: e.message })
    loading.value = false
  }
})

// ─── expose refresh to parent ─────────────────────────────────────────────
defineExpose({ refresh })
</script>

<style scoped>
.tan-mobile-list {
  position: relative;
  font-size: 14px;
}

/* Toolbar */
.tan-ml-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: var(--p-surface-0, #fff);
  border-bottom: 1px solid var(--p-surface-200, #e5e7eb);
}
.tan-ml-toolbar--sticky {
  position: sticky;
  top: 0;
  z-index: 10;
}
.tan-ml-toolbar-spacer { flex: 1; }

/* Head actions menu items */
.tan-ml-menu-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; cursor: pointer; text-decoration: none;
  color: var(--p-text-color, #374151); width: 100%;
}
.tan-ml-menu-item.tan-ml-item--success { color: var(--p-button-success-background, #22c55e); }
.tan-ml-menu-item.tan-ml-item--danger  { color: var(--p-button-danger-background,  #ef4444); }
.tan-ml-menu-item.tan-ml-item--warn    { color: var(--p-button-warn-background,    #f59e0b); }
.tan-ml-menu-item.tan-ml-item--info    { color: var(--p-button-info-background,    #3b82f6); }
.tan-ml-menu-item.tan-ml-item--secondary { color: var(--p-text-muted-color, #64748b); }
.tan-ml-filter-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  font-size: 10px;
  padding: 0 4px;
}
.tan-ml-select-all { margin-right: 4px; }

/* Loading / empty */
.tan-ml-loading, .tan-ml-empty {
  padding: 24px;
  text-align: center;
  color: var(--p-text-muted-color, #9ca3af);
}

/* Container scroll */
.tan-ml-scroll {
  overflow-y: auto;
  padding: 8px 8px 0;
}

/* Window scroll */
.tan-mobile-list > [ref="windowListRef"] {
  padding: 8px 8px 0;
}

/* Expand (extended row) */
.tan-ml-expand-body {
  border-left: 3px solid var(--p-primary-color, #6366f1);
  margin: 0 8px 8px;
  padding: 8px 0 0;
}

/* Paginator */
.tan-ml-paginator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid var(--p-surface-200, #e5e7eb);
}
.tan-ml-page-info { font-size: 13px; }

/* Bulk panel */
.tan-ml-bulk-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--p-surface-900, #1e1e2e);
  color: #fff;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  box-shadow: 0 -2px 12px rgba(0,0,0,.2);
}
.tan-ml-bulk-count { font-size: 13px; flex: 1; }
.tan-ml-bulk-actions { display: flex; gap: 8px; align-items: center; }

/* Bulk slide animation */
.tan-ml-bulk-slide-enter-active,
.tan-ml-bulk-slide-leave-active { transition: transform .2s ease; }
.tan-ml-bulk-slide-enter-from,
.tan-ml-bulk-slide-leave-to { transform: translateY(100%); }

/* Drawer header */
.tan-ml-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
</style>
