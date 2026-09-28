import { ref } from 'vue'

/**
 * Вставка блока из Excel в любую таблицу (общая, через api_action 'paste').
 *
 * Раньше вставка жила только в расчёте: таблица отдавала матрицу событием
 * paste-rows, а что с ней делать, решала страница. Теперь, если страница сама
 * вставку не слушает, таблица делает её сама: новые строки — create, строки
 * под выделением — update (на сервере, со всеми правами и триггерами).
 *
 * После вставки — плашка «Вставлено N» с параметрами разбора (переигрывают ту
 * же вставку) и «Отменить». В журнал таблицы вставка ложится одним шагом, чтобы
 * стрелка «отменить» в тулбаре откатывала её целиком.
 *
 * Права решает сервер. Здесь только не шлём запрос, если у таблицы нет ни
 * create, ни update: вставлять некуда.
 */
export function useTablePaste({ api, prepFilters, notify, refresh, cacheAction, replaceLastAction, undo, actionsGetter, columnsGetter }) {
  const buffer   = ref(null)    // что вставляли: матрица + раскладка колонок
  const info     = ref(null)    // плашка после вставки
  const busy     = ref(false)   // запрос в полёте: блокирует повторную вставку
  const optionsOpen = ref(false)
  const options  = ref({ skip_first: false, decimal_comma: true })

  let created   = []            // [{ id, data }] — для «Отменить»/«Повторить»
  let updated   = []            // [{ id, old, new }]
  let journaled = false         // вставка уже записана в журнал таблицы?
  let filtersAtPaste = null     // фильтры на момент вставки: откат идёт с ними же

  const canPaste = () => {
    const a = actionsGetter?.() || {}
    return !!(a.create || a.update)
  }

  // Первая строка — заголовок, если в числовой/датной колонке там текст:
  // «Цена» — заголовок, «1 234,56» — данные.
  const looksLikeHeader = (payload) => {
    const cols = columnsGetter?.() || []
    const typeOf = (f) => (cols.find(c => (c.field ?? c.id) === f) || {}).type
    const first = payload.rows[0] || []
    for (let i = 0; i < payload.fields.length; i++) {
      const t = typeOf(payload.fields[i])
      if (!['number', 'decimal', 'int', 'integer', 'float', 'date', 'datetime'].includes(t)) continue
      const v = String(first[i] ?? '').trim()
      if (v === '') continue
      if (/[^\d\s.,\-₽:]/u.test(v)) return true
    }
    return false
  }

  const onPaste = async (payload) => {
    if (!payload || !payload.rows || !payload.rows.length) return
    if (!canPaste()) {
      notify?.('warn', { detail: 'В эту таблицу вставлять нельзя: нет прав на добавление и изменение строк' })
      return
    }
    // Раньше проверки: иначе второй Ctrl+V подменит буфер первой вставки.
    if (busy.value) { notify?.('warn', { detail: 'Идёт вставка, подождите' }); return }
    // Прошлая вставка завершена: её строки остаются, «Отменить» теперь про новую.
    created = []; updated = []; journaled = false
    buffer.value = payload
    filtersAtPaste = prepFilters?.() || {}
    options.value = { skip_first: looksLikeHeader(payload), decimal_comma: true }
    await apply()
  }

  // replay — та же вставка с другими параметрами разбора: прошлый результат снимаем.
  const apply = async (replay = false) => {
    if (!buffer.value) return
    if (busy.value) { notify?.('warn', { detail: 'Идёт вставка, подождите' }); return }
    busy.value = true
    try {
      if (replay) await revert()
      const response = await api.action('paste', {
        rows: buffer.value.rows,
        fields: buffer.value.fields,
        row_ids: buffer.value.rowIds || [],
        skip_first: options.value.skip_first ? 1 : 0,
        decimal_comma: options.value.decimal_comma ? 1 : 0,
        filters: filtersAtPaste,
      })
      created = response.data?.created || []
      updated = response.data?.updated || []
      info.value = {
        count: created.length,
        updated: updated.length,
        warnings: response.data?.warnings || [],
      }
      const entry = {
        type: 'bulk',
        serverBulk: true,   // откат/повтор одним запросом paste_bulk
        created,
        updated: updated.map(u => ({ id: u.id, before: u.old, after: u.new })),
        filters: filtersAtPaste,
      }
      if (created.length || updated.length) {
        if (journaled) replaceLastAction?.(entry)
        else { cacheAction?.(entry); journaled = true }
      }
      refresh?.(false)
    } catch (e) {
      // Ошибку уже показал api (всплывашка) — плашку не держим.
      if (!replay) info.value = null
    }
    busy.value = false
  }

  // Откат своими силами — только для переигрывания (журнал заменим следом).
  const revert = async () => {
    if (created.length || updated.length) {
      await api.action('paste_bulk', {
        update: updated.map(u => ({ id: u.id, values: u.old })),
        delete: created.map(c => c.id),
        filters: filtersAtPaste || {},
      })
    }
    created = []; updated = []
  }

  const undoPaste = async () => {
    if (busy.value) { notify?.('warn', { detail: 'Идёт вставка, подождите' }); return }
    if (!created.length && !updated.length) { close(); return }
    busy.value = true
    try {
      // Через журнал таблицы, иначе в истории остался бы шаг об уже
      // отменённой вставке, и стрелка откатила бы его второй раз.
      if (journaled && undo) await undo()
      else await revert()
      created = []; updated = []
      notify?.('success', { detail: 'Вставка отменена' })
      close()
      refresh?.(false)
    } catch (e) { /* ошибку показал api */ }
    busy.value = false
  }

  const close = () => {
    info.value = null
    optionsOpen.value = false
    buffer.value = null
    created = []; updated = []; journaled = false
  }

  return { info, busy, options, optionsOpen, onPaste, apply, undoPaste, close }
}
