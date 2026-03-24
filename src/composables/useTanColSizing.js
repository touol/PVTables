import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

/**
 * Управление шириной колонок TanTable.
 * Приоритет: localStorage → сервер → авто-подгонка.
 *
 * @param {string}   tableName       - props.table
 * @param {object}   api             - apiCtor instance
 * @param {function} notify          - useNotifications().notify
 * @param {Ref}      scrollRef       - ref на .tan-scroll контейнер
 * @param {Ref}      actionsRow      - ref<boolean> — есть ли row-actions
 * @param {Ref}      rowActions      - computed/ref с массивом row-actions
 * @param {Ref}      visibleColumns  - computed/ref с массивом видимых колонок
 */
export function useTanColSizing({ tableName, api, notify, scrollRef, actionsRow, rowActions, visibleColumns, tableTree, speedDialEnabled, rowsGetter, actionBtnSize, rowDrag }) {
  const WIDTH_LS_KEY = `pvtables-${tableName}-column-widths-v2`
  const AUTOFIT_KEY  = `tan-autofit-${tableName}-v2`
  // Очистить устаревшие ключи предыдущих версий
  try {
    localStorage.removeItem(`pvtables-${tableName}-column-widths`)
    localStorage.removeItem(`tan-autofit-${tableName}`)
  } catch {}

  const serverFieldsStyle = ref(null)
  const columnSizing      = ref({})
  const autoFitCols       = ref(localStorage.getItem(AUTOFIT_KEY) !== 'false')
  const resizingColId     = ref(null)

  let _resizeObserver = null

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Разобрать ширины из формата PVTables:
   * { columnWidths: { field: { width: '150px', domIndex: N } } } → { field: 150 }
   */
  const parseSavedWidths = (raw) => {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      const src = parsed?.columnWidths ?? parsed ?? {}
      const result = {}
      for (const [field, data] of Object.entries(src)) {
        const w = data?.width ?? data
        const n = parseInt(w)
        if (!isNaN(n) && n > 0) result[field] = n
      }
      return Object.keys(result).length ? result : null
    } catch { return null }
  }

  /** Стиль колонки — аналог usePVTableStyles.getColumnStyle */
  const getColumnStyle = (col) => {
    let style = {}
    if (col.style && typeof col.style === 'object') style = { ...col.style }
    if (col.width)        style.width        = col.width
    if (col['min-width']) style['min-width'] = col['min-width']
    if (!Object.keys(style).length && (col.type === 'datetime' || col.type === 'textarea'))
      style['min-width'] = '190px'
    return style
  }

  /** Дефолтный числовой размер колонки */
  const getColDefaultSize = (col) => {
    if (col._width) return parseInt(col._width)
    if (col.width)  return parseInt(col.width)
    const s = getColumnStyle(col)
    if (s['min-width']) return parseInt(s['min-width'])
    if (col.field === 'id' || col.field.endsWith('_id')) return 65
    switch (col.type) {
      case 'boolean':  return 65
      case 'number':
      case 'decimal':  return 90
      case 'date':     return 110
      case 'datetime': return 165
      default:         return 150
    }
  }

  // ─── Save / load ───────────────────────────────────────────────────────────

  /** Сохранить columnSizing в localStorage в формате PVTables */
  const saveWidthsToLocal = () => {
    const columnWidths = {}
    Object.entries(columnSizing.value).forEach(([field, width], i) => {
      columnWidths[field] = { width: `${width}px`, domIndex: i + 3 }
    })
    try {
      localStorage.setItem(WIDTH_LS_KEY, JSON.stringify({ columnWidths }))
    } catch {}
  }

  /** Инициализация ширин: localStorage → сервер → авто-фит */
  const initColumnWidths = () => {
    const ls = parseSavedWidths(localStorage.getItem(WIDTH_LS_KEY))
    if (ls) { columnSizing.value = ls; autoFitCols.value = false; return }

    const srv = serverFieldsStyle.value ? parseSavedWidths(serverFieldsStyle.value) : null
    if (srv) { columnSizing.value = srv; autoFitCols.value = false; return }

    autoFitCols.value = true
  }

  // ─── Auto-fit ─────────────────────────────────────────────────────────────

  // Единый canvas для измерения текста (переиспользуется)
  let _measureCanvas = null
  const getMeasureCtx = () => {
    if (!_measureCanvas) _measureCanvas = document.createElement('canvas')
    return _measureCanvas.getContext('2d')
  }

  const measureText = (text, font) => {
    const ctx = getMeasureCtx()
    ctx.font = font
    return ctx.measureText(String(text ?? '')).width
  }

  /**
   * Подогнать ширины колонок под контейнер с учётом реального содержимого.
   * Алгоритм:
   *  1. Для каждой колонки вычисляем минимальную ширину:
   *     max(ширина_заголовка, макс_ширина_ячейки_по_выборке_строк)
   *  2. Если сумма влезает в контейнер — пропорционально растягиваем.
   *  3. Иначе — оставляем измеренные размеры (появится горизонтальный скролл).
   */
  const fitColumnsToContainer = () => {
    if (!scrollRef.value) return
    // clientWidth — внутренняя ширина без скроллбара и бордеров.
    // CSS width:100%;min-width:0 гарантирует что контейнер не расширяется по таблице.
    const containerWidth = scrollRef.value.clientWidth - 2
    if (!containerWidth) { requestAnimationFrame(() => fitColumnsToContainer()); return }

    const btnSlot = (actionBtnSize?.value ?? 32) + 2  // кнопка + gap
    const fixedWidth =
      (rowDrag?.value ? 28 : 0) +   // __drag__
      38 +   // __select__
      (tableTree?.value ? 34 : 0) +   // __expand__ (только для table_tree)
      (actionsRow.value ? (rowActions.value.length * btnSlot + (speedDialEnabled?.value ? btnSlot : 0) + 8) : 0)

    const dataCols = visibleColumns.value
    if (!dataCols.length) return

    const available = Math.max(containerWidth - fixedWidth, dataCols.length * 40)

    const HEADER_FONT   = '600 12px system-ui,sans-serif'  // .tan-th-label font
    const CELL_FONT     = '13px system-ui,sans-serif'       // .tan-td font
    const HEADER_PAD    = 34  // 8px left + 24px right (sort icon + filter btn)
    const CELL_PAD      = 16  // 8px × 2

    // Типы, для которых не измеряем содержимое (значение нечитаемо как текст)
    const SKIP_CONTENT  = new Set(['boolean', 'html', 'autocomplete', 'multiautocomplete', 'select'])

    const rows = rowsGetter?.() ?? []

    const measuredSizes = dataCols.map(col => {
      // Ширина заголовка
      const headerW = Math.ceil(measureText(col.label || col.field, HEADER_FONT)) + HEADER_PAD

      // Ширина содержимого по выборке строк
      let contentW = 0
      if (rows.length && !SKIP_CONTENT.has(col.type)) {
        const sample = rows.length > 100 ? rows.slice(0, 100) : rows
        for (const row of sample) {
          const val = row[col.field]
          if (val == null || val === '') continue
          const w = Math.ceil(measureText(val, CELL_FONT))
          if (w > contentW) contentW = w
        }
        if (contentW > 0) contentW += CELL_PAD
      }

      const minByType = getColDefaultSize(col)
      return Math.max(headerW, contentW || 0, minByType, 40)
    })

    const totalMeasured = measuredSizes.reduce((s, w) => s + w, 0)
    const newSizing = {}

    // Всегда масштабируем пропорционально — и растягиваем и сжимаем
    const scale = available / totalMeasured
    let distributed = 0
    dataCols.forEach((col, i) => {
      if (i === dataCols.length - 1) {
        newSizing[col.field] = Math.max(40, available - distributed)
      } else {
        const w = Math.max(40, Math.floor(measuredSizes[i] * scale))
        newSizing[col.field] = w
        distributed += w
      }
    })

    columnSizing.value = { ...columnSizing.value, ...newSizing }
  }

  // ─── Server save / reset ──────────────────────────────────────────────────

  const saveFieldsStyleToServer = async () => {
    const local = localStorage.getItem(WIDTH_LS_KEY)
    if (!local) { notify('warning', { detail: 'Нет локальных настроек ширины для сохранения' }); return }
    try {
      const response = await api.action('save_fields_style', { fields_style: JSON.parse(local) })
      if (response.success) {
        serverFieldsStyle.value = JSON.parse(local)
        notify('success', { detail: 'Ширина колонок сохранена на сервере' })
      } else {
        notify('error', { detail: response.data?.message || 'Ошибка сохранения' })
      }
    } catch (e) { notify('error', { detail: e.message }) }
  }

  const resetLocalWidths = () => {
    localStorage.removeItem(WIDTH_LS_KEY)
    const srv = serverFieldsStyle.value ? parseSavedWidths(serverFieldsStyle.value) : null
    if (srv) {
      columnSizing.value = srv
      autoFitCols.value = false
    } else {
      autoFitCols.value = true
      nextTick(() => fitColumnsToContainer())
    }
    notify('success', { detail: 'Локальная ширина колонок сброшена' })
  }

  const resetServerWidths = async () => {
    try {
      const response = await api.action('reset_fields_style', {})
      if (response.success) {
        serverFieldsStyle.value = null
        localStorage.removeItem(WIDTH_LS_KEY)
        autoFitCols.value = true
        nextTick(() => fitColumnsToContainer())
        notify('success', { detail: 'Ширина колонок на сервере сброшена' })
      } else {
        notify('error', { detail: response.data?.message || 'Ошибка сброса' })
      }
    } catch (e) { notify('error', { detail: e.message }) }
  }

  // ─── Resize handle ────────────────────────────────────────────────────────

  const onResizeMouseDown = (e, header) => {
    if (!header.column.getCanResize()) return
    resizingColId.value = header.column.id
    header.getResizeHandler()(e)
  }

  // ─── Watchers ─────────────────────────────────────────────────────────────

  watch(autoFitCols, v => {
    try { localStorage.setItem(AUTOFIT_KEY, String(v)) } catch {}
    if (v) nextTick(() => fitColumnsToContainer())
  })

  // Сохранять ширины в localStorage когда ресайз закончен
  watch(resizingColId, (cur, prev) => {
    if (prev && !cur && !autoFitCols.value) saveWidthsToLocal()
  })

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onMounted(() => {
    if (typeof ResizeObserver === 'undefined') return
    _resizeObserver = new ResizeObserver(() => {
      if (autoFitCols.value) fitColumnsToContainer()
    })
    nextTick(() => {
      if (scrollRef.value) _resizeObserver.observe(scrollRef.value)
    })
  })

  onBeforeUnmount(() => {
    _resizeObserver?.disconnect()
  })

  return {
    serverFieldsStyle,
    columnSizing,
    autoFitCols,
    resizingColId,
    parseSavedWidths,
    getColumnStyle,
    getColDefaultSize,
    saveWidthsToLocal,
    initColumnWidths,
    fitColumnsToContainer,
    saveFieldsStyleToServer,
    resetLocalWidths,
    resetServerWidths,
    onResizeMouseDown,
  }
}
