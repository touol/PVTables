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
  onPasteFn,
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

  // Колонка принимает вставку? Тот же смысл, что у isCellEditable в TanTable:
  // id не трогаем, readonly и нередактируемые типы - тоже.
  const NON_WRITABLE_TYPES = new Set(['view', 'html', 'hidden'])
  const isPasteTarget = (c) =>
    !!c && (c.field ?? c.id) !== 'id' && !c.readonly && !NON_WRITABLE_TYPES.has(c.type)

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
    const vis   = getVisibleRowKeySet()
    const items = lineItemsGetter()
    const cells = []
    for (let r = minRow; r <= maxRow; r++) {
      // Пропускаем строки, скрытые фильтром браузера — их не выделяем и не суммируем.
      if (vis) {
        const row = items[r]
        const key = row?.id ?? row?._rowKey
        if (!vis.has(key)) continue
      }
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

  // ─── Видимость строк (клиентский фильтр браузера) ──────────────────────
  // Набор ключей строк, видимых после клиентского фильтра (getFilteredRowModel).
  // Возвращает null если инстанс таблицы недоступен → без ограничения.
  const getVisibleRowKeySet = () => {
    const table = tableInstanceGetter?.()
    if (!table?.getFilteredRowModel) return null
    const set = new Set()
    for (const row of table.getFilteredRowModel().rows) {
      const o = row.original
      set.add(o?.id ?? o?._rowKey)
    }
    return set
  }

  // Выделенные ячейки БЕЗ строк, скрытых фильтром браузера. Используется для
  // суммы/среднего/счётчика/копирования — иначе считались бы и скрытые строки
  // (баг: сумма не менялась при фильтрации, т.к. selection по индексам lineItems).
  const visibleSelectedCells = computed(() => {
    const vis = getVisibleRowKeySet()
    if (!vis) return selectedCells.value
    return selectedCells.value.filter(c => vis.has(c.rowId))
  })

  // ─── Computed: sum, average, count ──────────────────────────────────────

  const cellCount = computed(() => visibleSelectedCells.value.length)

  const sum = computed(() => {
    const nums = visibleSelectedCells.value
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
    const cnt = visibleSelectedCells.value.filter(c => c.summable).length
    return cnt > 0 ? sum.value / cnt : null
  })

  // ─── Copy to clipboard (TSV) ───────────────────────────────────────────

  const copyToClipboard = async () => {
    const cellsToCopy = visibleSelectedCells.value
    if (cellsToCopy.length === 0) return
    const rowsMap = new Map()
    for (const cell of cellsToCopy) {
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
      notify?.('success', { detail: `Скопировано ${cellsToCopy.length} ячеек` })
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

  // ─── Вставка из буфера ────────────────────────────────────────────────

  /**
   * Разбор TSV из Excel.
   *
   * Наивный split('\n') здесь не годится: Excel оборачивает в кавычки ячейку,
   * внутри которой есть перенос строки, табуляция или сама кавычка, — а в
   * наименованиях товаров переносы бывают. Такая строка разъехалась бы пополам,
   * и вместо одной позиции получилось бы две, вторая без цены.
   *
   * Внутри кавычек двойная кавычка означает одну настоящую («"" → "»).
   */
  const parseTSV = (text) => {
    const rows = []
    let row = []
    let cell = ''
    let inQuotes = false

    // \r\n и \r приводим к \n, иначе в конце ячейки остаётся невидимый символ
    const src = String(text).replace(/\r\n?/g, '\n')

    for (let i = 0; i < src.length; i++) {
      const ch = src[i]
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++ }
          else inQuotes = false
        } else cell += ch
        continue
      }
      if (ch === '"' && cell === '') { inQuotes = true; continue }
      if (ch === '\t') { row.push(cell); cell = ''; continue }
      if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
      cell += ch
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row) }

    // Excel почти всегда добавляет перевод строки в конце выделения.
    while (rows.length && rows[rows.length - 1].every(c => String(c).trim() === '')) rows.pop()
    return rows
  }

  /**
   * Ctrl+V по таблице. Сама вставка — дело потребителя: он знает, что делать
   * с матрицей (создать строки расчёта, обновить существующие), а таблица
   * только разбирает буфер и говорит, с какой колонки вставляли.
   */
  // Последний клик был по этой таблице? Нужно, потому что браузер шлёт paste
  // активному элементу, а `td` фокус не принимает: закрыл редактор ячейки —
  // активным стал body, и событие приходит мимо таблицы. По одному
  // `contains(e.target)` вставка в таком состоянии молча игнорировалась.
  const clickedInside = ref(false)
  // Ячейка, по которой кликали последней: от неё считаем колонку вставки,
  // когда события paste приходят уже с body.
  const lastCellEl = ref(null)

  const onDocMouseDown = (e) => {
    const root = rootElGetter?.()
    clickedInside.value = !!(root && root.contains(e.target))
    if (clickedInside.value) {
      const td = e.target.closest?.('td[data-field]')
      if (td) lastCellEl.value = td
      // Клик по ячейке фокус никуда не ставит: td его не принимает, и
      // активным остаётся body - браузер отправит туда и paste. Поэтому
      // после клика забираем фокус на корень таблицы, но только если
      // никто не забрал его сам (редактор ячейки, фильтр, кнопка).
      setTimeout(() => {
        const a = document.activeElement
        if (!a || a === document.body) root.focus?.({ preventScroll: true })
      }, 0)
    }
  }

  const handlePaste = (e) => {
    const root = rootElGetter?.()
    if (!root) return
    if (!root.contains(e.target) && !clickedInside.value) return

    const text = e.clipboardData?.getData('text/plain')
    if (!text || !text.trim()) return

    // Блок из Excel или одно значение? Табуляция и перенос строки есть только
    // у блока. Это и решает спор с редактором ячейки: кликнув в ячейку,
    // менеджер остаётся в поле ввода, и обычная вставка одного значения туда
    // и идёт, а вставку таблицы мы перехватываем. Иначе вставить блок было бы
    // некуда: клик по ячейке сразу открывает редактор.
    const isBlock = /[\t\n]/.test(text.trim())

    const tag = (e.target.tagName || '').toLowerCase()
    const inEditor = tag === 'input' || tag === 'textarea' || e.target.isContentEditable
    if (inEditor && !isBlock) return

    const rows = parseTSV(text)
    if (!rows.length) return
    if (!isBlock && rows.length === 1 && rows[0].length === 1) return

    e.preventDefault()

    // Откуда вставляем. По порядку: выделенная ячейка → ячейка, в которой
    // открыт редактор (её имя поля берём с самого td) → первая колонка.
    const cols = getVisibleCols()
    const start = selectedCells.value.length ? selectedCells.value[0] : null
    let startColIndex = start ? start.colIndex : -1
    if (startColIndex < 0) {
      const td = (e.target.closest?.('td[data-field]')) || lastCellEl.value
      if (td) {
        const field = td.getAttribute('data-field')
        const idx = cols.findIndex(c => (c.field ?? c.id) === field)
        if (idx >= 0) startColIndex = idx
      }
    }
    if (startColIndex < 0) startColIndex = 0
    // В раскладку берём только колонки, куда вообще можно писать: вычисляемые
    // (цена, стоимость), id и readonly пропускаем, а не подставляем им значения.
    // Пропускаем, а не обрываем: менеджер копирует свои колонки подряд и ждёт,
    // что они перешагнут расчётные, а не лягут в них.
    const fields = cols.slice(startColIndex).filter(isPasteTarget).map(c => c.field ?? c.id)
    // Кликнули в расчётную колонку, и правее писать тоже некуда - вставлять
    // нечего. Молчать нельзя: со стороны это выглядит как «Ctrl+V не сработал».
    if (!fields.length) {
      notify?.('warn', { detail: 'В эти колонки вставить нельзя: они считаются автоматически' })
      return
    }

    // С какой строки накладывать. Вставка колонки цен на готовый список —
    // обычное дело: сперва вставили наименования, потом цены. Поэтому отдаём
    // id строк начиная со стартовой; чего не хватит — потребитель создаст.
    const items = lineItemsGetter() || []
    let startRowIndex = start ? start.rowIndex : -1
    if (startRowIndex < 0) {
      const tr = (e.target.closest?.('tr[data-index]')) || lastCellEl.value?.closest?.('tr[data-index]')
      const rowId = e.target.closest?.('td[data-field]') && tr ? tr.getAttribute('data-index') : null
      if (rowId !== null) {
        // data-index — позиция в виртуальном списке; ищем строку по её id,
        // чтобы не зависеть от того, есть ли над ней группы и подзаголовки.
        const td = (e.target.closest?.('td[data-field]')) || lastCellEl.value
        const cellRow = td?.closest('tr')
        const idAttr = cellRow?.getAttribute('data-row-id')
        if (idAttr) startRowIndex = items.findIndex(r => String(r.id) === String(idAttr))
      }
    }
    if (startRowIndex < 0) startRowIndex = 0
    const rowIds = items.slice(startRowIndex).map(r => r.id).filter(Boolean)

    if (typeof onPasteFn !== 'function') return
    onPasteFn({ rows, fields, startColIndex, rowIds, startRowId: start ? start.rowId : null })
  }

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
    // Вставку слушаем всегда, а не только в режиме выделения ячеек: копируют
    // из Excel и вставляют в пустую таблицу, где выделять ещё нечего.
    document.addEventListener('paste', handlePaste)
    document.addEventListener('mousedown', onDocMouseDown, true)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('mouseup', onCellMouseUp)
    document.removeEventListener('paste', handlePaste)
    document.removeEventListener('mousedown', onDocMouseDown, true)
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
    parseTSV,
  }
}
