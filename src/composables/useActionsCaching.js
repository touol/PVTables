import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const MAX_HISTORY = 100

/**
 * Undo/redo история CRUD-действий для TanTable.
 *
 * Запись в стеке:
 *   { type: 'update', id, field, dataBefore, dataAfter, filters }
 *   { type: 'insert', insertedId, insertedData, filters }
 *   { type: 'delete', deletedIds: [], deletedRows: [], filters }
 *
 * Инициализация через init() после создания всех composables.
 * cacheAction() вызывается из useTanCRUD после каждого успешного CRUD.
 */
export function useActionsCaching() {
  const undoStack = ref([])
  const redoStack = ref([])

  // Зависимости — заполняются через init()
  let _api = null
  let _lineItems = null
  let _findIndexById = null
  let _skipScroll = null
  let _refresh = null

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  /**
   * Инициализация зависимостей. Вызвать из TanTable.vue после useTanCRUD.
   */
  const init = (api, lineItems, findIndexById, skipScroll, refresh) => {
    _api = api
    _lineItems = lineItems
    _findIndexById = findIndexById
    _skipScroll = skipScroll
    _refresh = refresh
  }

  /**
   * Записать действие в историю. Вызывается из useTanCRUD.
   * Новое действие сбрасывает redo-стек.
   */
  const cacheAction = (entry) => {
    if (undoStack.value.length >= MAX_HISTORY) undoStack.value.shift()
    undoStack.value.push(entry)
    redoStack.value = []
  }

  // ── Применение состояния к lineItems ──────────────────────────────────────

  const _applyRowUpdate = (id, rowData) => {
    if (!_lineItems || !_findIndexById) return
    const idx = _findIndexById(Number(id))
    if (idx < 0) return
    const updated = [..._lineItems.value]
    updated[idx] = rowData
    _skipScroll?.()
    _lineItems.value = updated
  }

  // ── Undo ──────────────────────────────────────────────────────────────────

  const undo = async () => {
    if (!undoStack.value.length || !_api) return
    const entry = undoStack.value.pop()

    try {
      if (entry.type === 'update') {
        const f = entry.filters ? { filters: entry.filters } : {}
        if (entry.source === 'modal') {
          await _api.update(entry.dataBefore, { ...f, update_from_modal: 1 })
        } else {
          await _api.update({ id: entry.dataBefore.id, [entry.field]: entry.dataBefore[entry.field], update_from_row: 1 }, f)
        }
        _applyRowUpdate(entry.dataBefore.id, entry.dataBefore)

      } else if (entry.type === 'insert') {
        const deleteParams = entry.filters ? { ids: entry.insertedId, filters: entry.filters } : { ids: entry.insertedId }
        await _api.delete(deleteParams)
        _skipScroll?.(3)
        _refresh?.(false)

      } else if (entry.type === 'delete') {
        let ok = true
        const newIds = []
        for (const row of entry.deletedRows) {
          const { id, _rowKey, ...rowData } = row
          try {
            const resp = await _api.create(rowData, entry.filters ? { filters: entry.filters } : {})
            newIds.push(resp.data?.object?.id ?? null)
          } catch (e) {
            console.error('[undo] restore row error', e)
            ok = false
            newIds.push(null)
          }
        }
        _skipScroll?.(3)
        _refresh?.(false)
        const redoEntry = { ...entry, deletedIds: newIds.filter(Boolean) }
        if (ok) redoStack.value.push(redoEntry)
        else     undoStack.value.push(entry)
        return
      }

      redoStack.value.push(entry)
    } catch (e) {
      undoStack.value.push(entry)
      console.error('[undo] undo error', e)
    }
  }

  // ── Redo ──────────────────────────────────────────────────────────────────

  const redo = async () => {
    if (!redoStack.value.length || !_api) return
    const entry = redoStack.value.pop()

    try {
      if (entry.type === 'update') {
        const f = entry.filters ? { filters: entry.filters } : {}
        if (entry.source === 'modal') {
          await _api.update(entry.dataAfter, { ...f, update_from_modal: 1 })
        } else {
          await _api.update({ id: entry.dataAfter.id, [entry.field]: entry.dataAfter[entry.field], update_from_row: 1 }, f)
        }
        _applyRowUpdate(entry.dataAfter.id, entry.dataAfter)

      } else if (entry.type === 'insert') {
        const { id, _rowKey, ...rowData } = entry.insertedData
        await _api.create(rowData, entry.filters ? { filters: entry.filters } : {})
        _skipScroll?.(3)
        _refresh?.(false)

      } else if (entry.type === 'delete') {
        await _api.delete({ ids: entry.deletedIds.join(',') })
        _skipScroll?.(3)
        _refresh?.(false)
      }

      undoStack.value.push(entry)
    } catch (e) {
      redoStack.value.push(entry)
      console.error('[undo] redo error', e)
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const _onKeydown = (e) => {
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); undo() }
    if (e.ctrlKey && e.code === 'KeyY')                 { e.preventDefault(); redo() }
  }

  onMounted(()        => document.addEventListener('keydown', _onKeydown))
  onBeforeUnmount(()  => document.removeEventListener('keydown', _onKeydown))

  return { cacheAction, undo, redo, canUndo, canRedo, init }
}
