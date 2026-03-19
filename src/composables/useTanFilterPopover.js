import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/**
 * Управление popover-фильтром колонок TanTable.
 *
 * Секция 1 — серверная фильтрация (operator + constraints + matchMode → loadLazyData).
 * Секция 2 — клиентский чеклист уникальных значений из lineItems → TanStack columnFilters.
 */
export function useTanFilterPopover({
  filtersGetter,
  loadLazyDataGetter,
  initFiltersGetter,
  tableInstanceGetter,
  first,
  lazyParams,
  lineItemsGetter,
  columnsGetter,
  selectSettingsGetter,
  autocompleteSettingsGetter,
  acFullMapsGetter,
  getACContentFn,
  getSelectContentFn,
  formatDateFn,
  onChecklistChange,  // callback(colId, checkedSet) — для серверного режима
}) {
  const openFilterColId  = ref(null)
  const filterPopoverPos = ref({ top: 0, left: 0 })

  // ─── matchMode опции по типу колонки ────────────────────────────────────
  const MATCH_MODES = {
    text:     ['startsWith', 'contains', 'equals', 'notEquals'],
    textarea: ['startsWith', 'contains', 'equals', 'notEquals'],
    view:     ['startsWith', 'contains', 'equals', 'notEquals'],
    number:   ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte'],
    decimal:  ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte'],
    autocomplete: ['equals', 'notEquals'],
    select:       ['equals', 'notEquals'],
    date:     ['dateAfter', 'dateBefore', 'equals'],
    boolean:  ['equals'],
  }

  const MATCH_MODE_LABELS = {
    startsWith: 'Начинается с',
    contains:   'Содержит',
    equals:     'Равно',
    notEquals:  'Не равно',
    gt:         'Больше',
    gte:        'Больше или равно',
    lt:         'Меньше',
    lte:        'Меньше или равно',
    dateAfter:  'После',
    dateBefore: 'До',
  }

  const OPERATOR_LABELS = { and: 'Сопоставить все', or: 'Сопоставить любой' }

  // ─── Серверные фильтры: colId → { operator, constraints } ──────────────
  const colServerFilters = ref({})

  const getDefaultMatchMode = (colType) => {
    const modes = MATCH_MODES[colType] || MATCH_MODES.text
    return modes[0]
  }

  const ensureServerFilter = (colId, colType) => {
    if (!colServerFilters.value[colId]) {
      colServerFilters.value[colId] = {
        operator: 'and',
        constraints: [{ value: '', matchMode: getDefaultMatchMode(colType) }],
      }
    }
    return colServerFilters.value[colId]
  }

  // ─── Чеклист: colId → Set<string> выбранных значений ───────────────────
  const colChecklistState = ref({})  // colId → { all: [{value,label}], checked: Set }

  const buildUniqueValues = (colId) => {
    const items = lineItemsGetter?.() ?? []
    const cols  = columnsGetter?.() ?? []
    const col   = cols.find(c => c.field === colId)
    if (!col) return []

    const seen = new Map()  // value → label

    for (const row of items) {
      const raw = row[colId]
      if (raw === null || raw === undefined || raw === '') continue
      const key = String(raw)
      if (seen.has(key)) continue

      let label = key
      switch (col.type) {
        case 'autocomplete': {
          const content = getACContentFn?.(colId, raw) ?? ''
          if (col.hide_id) {
            label = content || key
          } else if (col.show_id) {
            const fullRow = acFullMapsGetter?.()[colId]?.get(key)
            const sv = fullRow?.[col.show_id]
            const showVal = (sv !== null && sv !== undefined && sv !== '' && sv != 0) ? sv : raw
            label = `${showVal} ${content}`
          } else {
            label = `${raw} ${content}`
          }
          break
        }
        case 'select': {
          const content = getSelectContentFn?.(colId, raw)
          label = content || key
          break
        }
        case 'date': {
          label = formatDateFn?.(raw) || key
          break
        }
      }
      seen.set(key, label)
    }

    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }))
  }

  // ─── Открыть / закрыть popover ──────────────────────────────────────────

  const openFilterPopover = (e, columnId) => {
    if (openFilterColId.value === columnId) { openFilterColId.value = null; return }
    const rect = e.currentTarget.getBoundingClientRect()
    filterPopoverPos.value = { top: rect.bottom + 4, left: rect.left }
    openFilterColId.value = columnId

    // Собираем уникальные значения для чеклиста
    const uniqueVals = buildUniqueValues(columnId)
    const prev = colChecklistState.value[columnId]
    if (!prev) {
      // Первое открытие — все выбраны (= нет фильтра)
      colChecklistState.value[columnId] = {
        all: uniqueVals,
        checked: new Set(uniqueVals.map(v => v.value)),
      }
    } else {
      // Обновляем список значений, сохраняя checked
      colChecklistState.value[columnId] = { ...prev, all: uniqueVals }
    }

    // Подготовка серверного фильтра
    const cols = columnsGetter?.() ?? []
    const col = cols.find(c => c.field === columnId)
    ensureServerFilter(columnId, col?.type)
  }

  const closeFilterPopover = () => {
    openFilterColId.value = null
  }

  // ─── Серверная фильтрация ───────────────────────────────────────────────

  const applyServerFilter = (colId) => {
    const filters      = filtersGetter()
    const loadLazyData = loadLazyDataGetter()
    const initFilters  = initFiltersGetter()
    if (!filters || !loadLazyData) return

    initFilters?.()

    // Применяем все серверные фильтры колонок
    for (const [cId, sf] of Object.entries(colServerFilters.value)) {
      const hasValue = sf.constraints.some(c => c.value !== '' && c.value !== null && c.value !== undefined)
      if (hasValue && filters) {
        filters.value[cId] = {
          operator: sf.operator,
          constraints: sf.constraints
            .filter(c => c.value !== '' && c.value !== null && c.value !== undefined)
            .map(c => ({ value: c.value, matchMode: c.matchMode })),
        }
      }
    }

    first.value = 0
    if (lazyParams.value) lazyParams.value.first = 0
    loadLazyData()
    openFilterColId.value = null
  }

  const clearServerFilter = (colId) => {
    delete colServerFilters.value[colId]
    applyServerFilter(colId)
  }

  const addConstraint = (colId, colType) => {
    const sf = ensureServerFilter(colId, colType)
    sf.constraints.push({ value: '', matchMode: getDefaultMatchMode(colType) })
  }

  const removeConstraint = (colId, idx) => {
    const sf = colServerFilters.value[colId]
    if (!sf || sf.constraints.length <= 1) return
    sf.constraints.splice(idx, 1)
  }

  // ─── Чеклист фильтрация (клиентская) ───────────────────────────────────

  const toggleChecklistValue = (colId, value) => {
    const state = colChecklistState.value[colId]
    if (!state) return

    const checked = new Set(state.checked)
    if (checked.has(value)) checked.delete(value)
    else checked.add(value)

    colChecklistState.value[colId] = { ...state, checked }
    applyChecklist(colId)
  }

  const toggleChecklistAll = (colId) => {
    const state = colChecklistState.value[colId]
    if (!state) return

    const allChecked = state.checked.size === state.all.length
    const checked = allChecked ? new Set() : new Set(state.all.map(v => v.value))
    colChecklistState.value[colId] = { ...state, checked }
    applyChecklist(colId)
  }

  const applyChecklist = (colId) => {
    const state = colChecklistState.value[colId]
    if (!state) return

    const table = tableInstanceGetter()
    const column = table?.getColumn(colId)

    if (column) {
      // Клиентский режим (TanStack Table)
      if (state.checked.size === state.all.length || state.checked.size === 0) {
        column.setFilterValue(undefined)
      } else {
        column.setFilterValue(state.checked)
      }
    } else if (onChecklistChange) {
      // Серверный режим — передаём Set наружу
      onChecklistChange(colId, state.checked, state.all)
    }
  }

  // ─── Active filter indicators ───────────────────────────────────────────

  const hasActiveServerFilter = (colId) => {
    const sf = colServerFilters.value[colId]
    if (!sf) return false
    return sf.constraints.some(c => c.value !== '' && c.value !== null && c.value !== undefined)
  }

  const hasActiveChecklistFilter = (colId) => {
    const state = colChecklistState.value[colId]
    if (!state) return false
    return state.checked.size < state.all.length && state.checked.size > 0
  }

  const isFilterActive = (colId) => hasActiveServerFilter(colId) || hasActiveChecklistFilter(colId)

  // ─── Полная очистка фильтра колонки ─────────────────────────────────────

  const clearColFilter = (colId) => {
    // Сбрасываем серверный
    delete colServerFilters.value[colId]
    // Сбрасываем чеклист
    const state = colChecklistState.value[colId]
    if (state) {
      colChecklistState.value[colId] = { ...state, checked: new Set(state.all.map(v => v.value)) }
    }
    // Убираем TanStack фильтр
    tableInstanceGetter()?.getColumn(colId)?.setFilterValue(undefined)
    // Применяем серверные
    const filters      = filtersGetter()
    const loadLazyData = loadLazyDataGetter()
    const initFilters  = initFiltersGetter()
    if (!filters || !loadLazyData) return
    initFilters?.()
    for (const [cId, sf] of Object.entries(colServerFilters.value)) {
      const hasValue = sf.constraints.some(c => c.value !== '' && c.value !== null)
      if (hasValue) {
        filters.value[cId] = {
          operator: sf.operator,
          constraints: sf.constraints.filter(c => c.value !== '' && c.value !== null),
        }
      }
    }
    first.value = 0
    if (lazyParams.value) lazyParams.value.first = 0
    loadLazyData()
    openFilterColId.value = null
  }

  // ─── Закрытие по клику вне ──────────────────────────────────────────────

  const onDocumentClick = e => {
    if (!e.target.closest('.tan-filter-popover') && !e.target.closest('.tan-filter-btn'))
      closeFilterPopover()
  }

  onMounted(() => document.addEventListener('click', onDocumentClick, true))
  onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick, true))

  return {
    openFilterColId,
    filterPopoverPos,
    colServerFilters,
    colChecklistState,
    MATCH_MODES,
    MATCH_MODE_LABELS,
    OPERATOR_LABELS,
    openFilterPopover,
    closeFilterPopover,
    applyServerFilter,
    clearServerFilter,
    clearColFilter,
    addConstraint,
    removeConstraint,
    toggleChecklistValue,
    toggleChecklistAll,
    isFilterActive,
    ensureServerFilter,
    initColFilter: (colId, colType) => {
      ensureServerFilter(colId, colType)
      const uniqueVals = buildUniqueValues(colId)
      const prev = colChecklistState.value[colId]
      if (!prev) {
        colChecklistState.value[colId] = {
          all: uniqueVals,
          checked: new Set(uniqueVals.map(v => v.value)),
        }
      } else {
        colChecklistState.value[colId] = { ...prev, all: uniqueVals }
      }
    },
  }
}
