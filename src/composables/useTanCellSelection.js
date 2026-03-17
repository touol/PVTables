import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/**
 * Excel-like cell selection for TanTable.
 *
 * Features:
 * - Click to select a cell, Shift+click for range, Ctrl+click to add
 * - Drag to select a range of cells
 * - Sum/average of numeric cells displayed in status bar
 * - Copy selected cells to clipboard as TSV
 * - Fill handle: drag to copy value to adjacent cells
 * - Fill with increment: Ctrl+drag fill handle to add +1 per row
 */
export function useTanCellSelection({
  columnsGetter,
  lineItemsGetter,
  tableInstanceGetter,
  customFieldsGetter,
  saveCellUpdateFn,
  notify,
  isEmptyRowFn,
  isEditableEmptyRowFn,
  hideIdGetter,
  rootElGetter,
}) {
  const cellSelectionMode = ref(false)
  const selectedCells     = ref([])   // [{ rowId, field, rowIndex, colIndex, value, displayValue, summable }]
  const selectionStart    = ref(null) // { rowIndex, colIndex }
  const isSelecting       = ref(false)

  // Fill handle
  const isFillDragging  = ref(false)
  const fillSource      = ref(null)   // { rowIndex, colIndex, value, field }
  const fillRange       = ref([])     // [{ rowId, field, rowIndex, colIndex }]
  const fillIncrement   = ref(false)  // Ctrl held → increment mode

  // ─── Helpers ────────────────────────────────────────────────────────────

  const getVisibleCols = () => {
    return columnsGetter().filter(c =>
      !c.modal_only && c.type !== 'hidden' && !(hideIdGetter() && c.field === 'id')
    )
  }

  const isSummable = (col) => col.type === 'decimal' || col.type === 'number'

  const isFieldReadonly = (rowData, field) => {
    const col = columnsGetter().find(c => c.field === field)
    if (!col) return true
    if (col.readonly === true || col.readonly === 1) return true
    const cf = customFieldsGetter()?.[rowData.id]?.[field]
    if (cf && (cf.readonly === true || cf.readonly === 1)) return true
    return false
  }

  /** Build cell data object from rowIndex (in lineItems) + colIndex (in visibleColumns) */
  const buildCellData = (rowIndex, colIndex) => {
    const items = lineItemsGetter()
    const cols  = getVisibleCols()
    if (rowIndex < 0 || rowIndex >= items.length) return null
    const col = cols[colIndex]
    if (!col) return null
    const row = items[rowIndex]
    if (!row) return null

    const value = row[col.field]
    return {
      rowId: row.id ?? row._rowKey,
      rowIndex,
      colIndex,
      field: col.field,
      label: col.label,
      value,
      displayValue: value,
      summable: isSummable(col),
      type: col.type,
    }
  }

  // ─── Toggle mode ───────────────────────────────────────────────────────

  const toggleCellSelectionMode = () => {
    cellSelectionMode.value = !cellSelectionMode.value
    if (!cellSelectionMode.value) {
      selectedCells.value = []
      selectionStart.value = null
      isSelecting.value = false
      isFillDragging.value = false
      fillRange.value = []
    }
  }

  // ─── Mouse handlers (called from template) ─────────────────────────────

  /** rowIndex = index in lineItems, colIndex = index in visibleColumns */
  const onCellMouseDown = (rowIndex, colIndex, event) => {
    if (!cellSelectionMode.value) return

    // Don't interfere with fill handle
    if (event.target.closest('.tan-fill-handle')) return

    isSelecting.value = true
    selectionStart.value = { rowIndex, colIndex }

    const cell = buildCellData(rowIndex, colIndex)
    if (!cell) return

    if (event.shiftKey && selectedCells.value.length > 0) {
      // Range from first selected to this
      const start = selectionStart.value
      selectRange(
        Math.min(start.rowIndex, rowIndex), Math.min(start.colIndex, colIndex),
        Math.max(start.rowIndex, rowIndex), Math.max(start.colIndex, colIndex),
        event.ctrlKey || event.metaKey
      )
    } else if (event.ctrlKey || event.metaKey) {
      // Toggle single cell
      const idx = selectedCells.value.findIndex(c => c.rowIndex === rowIndex && c.colIndex === colIndex)
      if (idx >= 0) selectedCells.value.splice(idx, 1)
      else selectedCells.value.push(cell)
    } else {
      selectedCells.value = [cell]
    }
  }

  const onCellMouseEnter = (rowIndex, colIndex) => {
    if (!cellSelectionMode.value) return

    if (isFillDragging.value) {
      updateFillRange(rowIndex, colIndex)
      return
    }

    if (!isSelecting.value || !selectionStart.value) return
    const s = selectionStart.value
    selectRange(
      Math.min(s.rowIndex, rowIndex), Math.min(s.colIndex, colIndex),
      Math.max(s.rowIndex, rowIndex), Math.max(s.colIndex, colIndex),
      false
    )
  }

  const onCellMouseUp = async () => {
    isSelecting.value = false
    if (isFillDragging.value && fillRange.value.length > 0) {
      await applyFillHandle()
    }
    isFillDragging.value = false
    fillSource.value = null
    fillRange.value = []
    fillIncrement.value = false
  }

  // ─── Range selection helper ─────────────────────────────────────────────

  const selectRange = (minRow, minCol, maxRow, maxCol, additive) => {
    const cells = []
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = buildCellData(r, c)
        if (cell) cells.push(cell)
      }
    }
    if (additive) {
      // Remove duplicates from existing + new
      const existing = selectedCells.value.filter(c =>
        !(c.rowIndex >= minRow && c.rowIndex <= maxRow && c.colIndex >= minCol && c.colIndex <= maxCol)
      )
      selectedCells.value = [...existing, ...cells]
    } else {
      selectedCells.value = cells
    }
  }

  // ─── Fill handle ────────────────────────────────────────────────────────

  const startFillDrag = (event, increment) => {
    event.stopPropagation()
    event.preventDefault()
    if (selectedCells.value.length !== 1) return

    isFillDragging.value = true
    fillIncrement.value = increment
    const src = selectedCells.value[0]
    fillSource.value = { ...src }
    fillRange.value = []
  }

  const onFillHandleMouseDown = (event) => startFillDrag(event, false)
  const onFillIncMouseDown    = (event) => startFillDrag(event, true)

  const updateFillRange = (rowIndex, colIndex) => {
    if (!fillSource.value) return
    const src = fillSource.value
    const minRow = Math.min(src.rowIndex, rowIndex)
    const maxRow = Math.max(src.rowIndex, rowIndex)
    const minCol = Math.min(src.colIndex, colIndex)
    const maxCol = Math.max(src.colIndex, colIndex)

    const range = []
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (r === src.rowIndex && c === src.colIndex) continue
        const cell = buildCellData(r, c)
        if (cell) range.push(cell)
      }
    }
    fillRange.value = range
  }

  const applyFillHandle = async () => {
    if (!fillSource.value || fillRange.value.length === 0 || !saveCellUpdateFn) return

    const srcField = fillSource.value.field
    const srcValue = fillSource.value.value

    if (srcField === 'id') {
      notify?.('error', { detail: 'Копирование поля ID запрещено' }, true)
      fillRange.value = []
      return
    }

    const readonlyErrors = []
    const isIncrement = fillIncrement.value
    const isNumeric = typeof srcValue === 'number' || (typeof srcValue === 'string' && /^-?\d+(\.\d+)?$/.test(srcValue?.toString().trim()))
    const baseNum = isNumeric ? Number(srcValue) : null

    // Sort fill range by row index for consistent increment
    const sorted = [...fillRange.value].sort((a, b) => a.rowIndex - b.rowIndex || a.colIndex - b.colIndex)

    for (let i = 0; i < sorted.length; i++) {
      const cell = sorted[i]
      if (cell.field !== srcField) continue

      const items = lineItemsGetter()
      const rowData = items[cell.rowIndex]
      if (!rowData) continue

      if (isFieldReadonly(rowData, srcField)) {
        readonlyErrors.push(`Строка ${cell.rowIndex + 1}, поле "${cell.label}"`)
        continue
      }

      let newValue = srcValue
      if (isIncrement && baseNum !== null) {
        // Calculate offset from source row
        const rowDiff = cell.rowIndex - fillSource.value.rowIndex
        newValue = baseNum + rowDiff
        if (typeof srcValue === 'string') newValue = String(newValue)
      }

      await saveCellUpdateFn(rowData, srcField, newValue)
    }

    if (readonlyErrors.length > 0) {
      notify?.('error', { detail: `Readonly ячейки:\n${readonlyErrors.join('\n')}` }, true)
    }

    fillRange.value = []
  }

  // ─── Computed: sum, average, count ──────────────────────────────────────

  const cellCount = computed(() => selectedCells.value.length)

  const sum = computed(() => {
    const nums = selectedCells.value
      .filter(c => c.summable)
      .map(c => {
        if (typeof c.value === 'number') return c.value
        if (typeof c.value === 'string') {
          const n = parseFloat(c.value.replace(/\s/g, '').replace(',', '.'))
          return isNaN(n) ? null : n
        }
        return null
      })
      .filter(n => n !== null)
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null
  })

  const average = computed(() => {
    if (sum.value === null) return null
    const cnt = selectedCells.value.filter(c => c.summable).length
    return cnt > 0 ? sum.value / cnt : null
  })

  // ─── Copy to clipboard (TSV) ───────────────────────────────────────────

  const copyToClipboard = async () => {
    if (selectedCells.value.length === 0) return
    const rowsMap = new Map()
    for (const cell of selectedCells.value) {
      if (!rowsMap.has(cell.rowIndex)) rowsMap.set(cell.rowIndex, [])
      rowsMap.get(cell.rowIndex).push(cell)
    }
    const tsv = Array.from(rowsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, cells]) =>
        cells.sort((a, b) => a.colIndex - b.colIndex)
          .map(c => String(c.value ?? '').replace(/\t/g, ' ').replace(/\n/g, ' '))
          .join('\t')
      )
      .join('\n')
    try {
      await navigator.clipboard.writeText(tsv)
      notify?.('success', { detail: `Скопировано ${selectedCells.value.length} ячеек` })
    } catch (e) {
      notify?.('error', { detail: 'Ошибка копирования: ' + e.message })
    }
  }

  // ─── Is cell in selection / fill range (for CSS highlighting) ──────────

  const isCellSelected = (rowIndex, colIndex) =>
    selectedCells.value.some(c => c.rowIndex === rowIndex && c.colIndex === colIndex)

  const isCellInFillRange = (rowIndex, colIndex) =>
    fillRange.value.some(c => c.rowIndex === rowIndex && c.colIndex === colIndex)

  // ─── Show fill handle only when exactly 1 cell is selected ─────────────

  const fillHandleCell = computed(() =>
    selectedCells.value.length === 1 ? selectedCells.value[0] : null
  )

  // ─── Keyboard shortcut ─────────────────────────────────────────────────

  const handleKeyDown = (e) => {
    // Ctrl+Shift+S → toggle selection mode
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyS') {
      const root = rootElGetter?.()
      if (root && !root.contains(e.target)) return
      e.preventDefault()
      toggleCellSelectionMode()
      return
    }
    // Ctrl+C in selection mode → copy
    if (cellSelectionMode.value && (e.ctrlKey || e.metaKey) && e.code === 'KeyC' && selectedCells.value.length > 0) {
      e.preventDefault()
      copyToClipboard()
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mouseup', onCellMouseUp)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('mouseup', onCellMouseUp)
  })

  return {
    cellSelectionMode,
    selectedCells,
    isSelecting,
    isFillDragging,
    fillRange,
    fillHandleCell,
    cellCount,
    sum,
    average,
    toggleCellSelectionMode,
    onCellMouseDown,
    onCellMouseEnter,
    onCellMouseUp,
    onFillHandleMouseDown,
    onFillIncMouseDown,
    isCellSelected,
    isCellInFillRange,
    copyToClipboard,
  }
}
