import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'

/**
 * Управление popover-фильтром колонок TanTable (серверная фильтрация).
 *
 * Параметры-геттеры нужны потому, что filters/loadLazyData/initFilters
 * присваиваются внутри onMounted после await — они не ref, а let-переменные.
 * Геттер захватывает переменную по ссылке и возвращает актуальное значение.
 *
 * @param {function} filtersGetter        - () => filters
 * @param {function} loadLazyDataGetter   - () => loadLazyData
 * @param {function} initFiltersGetter    - () => initFilters
 * @param {function} tableInstanceGetter  - () => tableInstance
 * @param {Ref}      first                - ref<number> из usePVTableData
 * @param {Ref}      lazyParams           - ref из usePVTableData
 */
export function useTanFilterPopover({
  filtersGetter,
  loadLazyDataGetter,
  initFiltersGetter,
  tableInstanceGetter,
  first,
  lazyParams,
}) {
  const openFilterColId  = ref(null)
  const filterPopoverPos = ref({ top: 0, left: 0 })
  const colFilterValues  = ref({})

  // ─── Открыть / закрыть popover ────────────────────────────────────────────

  const openFilterPopover = (e, columnId) => {
    if (openFilterColId.value === columnId) { openFilterColId.value = null; return }
    const rect = e.currentTarget.getBoundingClientRect()
    filterPopoverPos.value = { top: rect.bottom + 4, left: rect.left }
    openFilterColId.value = columnId
  }

  const closeFilterPopover = (andApply = false) => {
    if (andApply) applyColFilterToServer()
    openFilterColId.value = null
  }

  // ─── Серверная фильтрация ─────────────────────────────────────────────────

  const applyColFilterToServer = () => {
    const filters      = filtersGetter()
    const loadLazyData = loadLazyDataGetter()
    const initFilters  = initFiltersGetter()
    if (!filters || !loadLazyData) return

    // Сбрасываем к состоянию из props.filters, затем добавляем колоночные фильтры
    initFilters?.()
    for (const [colId, val] of Object.entries(colFilterValues.value)) {
      if (val && filters) {
        filters.value[colId] = {
          operator: 'and',
          constraints: [{ value: val, matchMode: 'startsWith' }],
        }
      }
    }
    first.value = 0
    if (lazyParams.value) lazyParams.value.first = 0
    loadLazyData()
  }

  const clearColFilter = (columnId) => {
    const vals = { ...colFilterValues.value }
    delete vals[columnId]
    colFilterValues.value = vals
    // Убираем из TanStack для визуального индикатора
    tableInstanceGetter()?.getColumn(columnId)?.setFilterValue(undefined)
    applyColFilterToServer()
    openFilterColId.value = null
  }

  // ─── Computed v-model для input активного фильтра ────────────────────────

  const openFilterValue = computed({
    get: () => {
      if (!openFilterColId.value) return ''
      return colFilterValues.value[openFilterColId.value] ?? ''
    },
    set: v => {
      if (!openFilterColId.value) return
      const vals = { ...colFilterValues.value }
      if (v) {
        vals[openFilterColId.value] = v
      } else {
        delete vals[openFilterColId.value]
      }
      colFilterValues.value = vals
      // Синхронизируем с TanStack для визуального индикатора активного фильтра
      tableInstanceGetter()?.getColumn(openFilterColId.value)?.setFilterValue(v || undefined)
    },
  })

  // ─── Закрытие по клику вне popover ───────────────────────────────────────

  const onDocumentClick = e => {
    if (!e.target.closest('.tan-filter-popover') && !e.target.closest('.tan-filter-btn'))
      closeFilterPopover(false)
  }

  onMounted(() => {
    document.addEventListener('click', onDocumentClick, true)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocumentClick, true)
  })

  return {
    openFilterColId,
    filterPopoverPos,
    colFilterValues,
    openFilterValue,
    openFilterPopover,
    applyColFilterToServer,
    closeFilterPopover,
    clearColFilter,
  }
}
