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
  // Очистить устаревшие ключи предыдущих версий (включая AUTOFIT_KEY — больше не нужен,
  // autoFitCols выводится из наличия WIDTH_LS_KEY: есть сохранённые ширины — autoFit off)
  try {
    localStorage.removeItem(`pvtables-${tableName}-column-widths`)
    localStorage.removeItem(`tan-autofit-${tableName}`)
    localStorage.removeItem(`tan-autofit-${tableName}-v2`)
  } catch {}

  const serverFieldsStyle = ref(null)
  const columnSizing      = ref({})
  // autoFitCols=true только если нет сохранённых локальных ширин.
  // Юзер начал resize → переключаем в false (in-memory, не persistent).
  // После reload снова true, если не нажал «Сохранить локально».
  const autoFitCols       = ref(!localStorage.getItem(WIDTH_LS_KEY))
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

  /** Сохранить ширины ВСЕХ видимых колонок в localStorage в формате PVTables.
   *  Для каждой колонки эффективная ширина = columnSizing[field] (если юзер
   *  ресайзил) либо getColDefaultSize(col). Иначе после reload не-ресайзенные
   *  столбцы падали бы в default — таблица выглядела бы иначе чем при сохранении. */
  const saveWidthsToLocal = () => {
    const columnWidths = {}
    const cols = visibleColumns?.value || []
    cols.forEach((col, i) => {
      const w = columnSizing.value[col.field] ?? getColDefaultSize(col)
      columnWidths[col.field] = { width: `${w}px`, domIndex: i + 3 }
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
    // row_print (PVPrintAction в compact: иконка-print + chevron в InputGroup).
    const ROW_PRINT_SLOT = 65
    const actionsWidth = actionsRow.value
      ? rowActions.value.reduce((s, a) => s + (a.isRowPrint ? ROW_PRINT_SLOT : btnSlot) + 5, 0)
        + (speedDialEnabled?.value ? btnSlot : 0)
        + 8
      : 0
    const fixedWidth =
      (rowDrag?.value ? 28 : 0) +   // __drag__
      38 +   // __select__
      (tableTree?.value ? 34 : 0) +   // __expand__ (только для table_tree)
      actionsWidth

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
    // Берём ширины из in-memory columnSizing + дефолты для не-ресайзенных
    // (та же логика что и в saveWidthsToLocal — чтобы reload давал точную копию).
    const cols = visibleColumns?.value || []
    if (!cols.length) {
      notify('warning', { detail: 'Нет настроенных ширин для сохранения' }); return
    }
    const columnWidths = {}
    cols.forEach((col, i) => {
      const w = columnSizing.value[col.field] ?? getColDefaultSize(col)
      columnWidths[col.field] = { width: `${w}px`, domIndex: i + 3 }
    })
    const payload = { columnWidths }
    try {
      const response = await api.action('save_fields_style', { fields_style: payload })
      if (response.success) {
        serverFieldsStyle.value = payload
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
    // Юзер начал ресайз — отключаем авто-подгонку чтобы ResizeObserver
    // не перезатёр уже изменённые столбцы при следующем тике. In-memory only:
    // после reload без явного «Сохранить локально» autoFitCols снова true.
    autoFitCols.value = false
    resizingColId.value = header.column.id
    header.getResizeHandler()(e)
  }

  // ─── Watchers ─────────────────────────────────────────────────────────────

  // При включении автоподгонки — перерассчитать ширины. Persist в LS не делаем:
  // autoFitCols выводится из наличия сохранённых ширин (см. инициализацию).
  watch(autoFitCols, v => {
    if (v) nextTick(() => fitColumnsToContainer())
  })

  // Ширины НЕ сохраняем автоматически после resize — только по явной команде
  // юзера через UI «Сохранить локально» (saveWidthsToLocal вызывается из TanTable
  // по @save-local).

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onMounted(() => {
    if (typeof ResizeObserver === 'undefined') return
    // Наблюдаем РОДИТЕЛЯ scroll-контейнера: появление/пропадание вертикального
    // скроллбара меняет clientWidth самого .tan-scroll, но не его родителя.
    // При этом родитель содержит toolbar, чья ВЫСОТА меняется — а ResizeObserver
    // срабатывает на любое изменение размера. Поэтому фильтруем по ширине вручную.
    let _observedWidth = 0
    _resizeObserver = new ResizeObserver(entries => {
      if (!autoFitCols.value) return
      const w = entries[0]?.contentRect?.width ?? 0
      if (w && Math.abs(w - _observedWidth) < 1) return  // сменилась только высота — игнор
      _observedWidth = w
      fitColumnsToContainer()
    })
    nextTick(() => {
      const target = scrollRef.value?.parentElement || scrollRef.value
      if (target) _resizeObserver.observe(target)
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
