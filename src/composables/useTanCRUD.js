import { ref, nextTick } from 'vue';

/**
 * Composable для CRUD операций TanStack-таблицы.
 * Заменяет usePVTableCRUD для TanTable.vue:
 *   - вместо onCellEditComplete — saveCellUpdate (TanStack inline-editing)
 *   - consumeSkip() — счётчик для подавления сброса скролла в watch(lineItems)
 *   - insert пустых строк через api.action('insert', ...)
 */
export function useTanCRUD(
  api,
  prepFilters,
  notify,
  refresh,
  emit,
  props,
  lineItems,
  findIndexById,
  customFields,
  row_setting,
  table_tree,             // не используется в TanStack, оставлен для совместимости
  expandedTableTreeRows,  // не используется в TanStack, оставлен для совместимости
  childComponentRefs,     // не используется в TanStack, оставлен для совместимости
  emptyRowsHelpers = {},
  selectedlineItemsRef = null,
  fieldsRef = null,       // Ref<fields> — для updateEmptyRow после insert
  activeInline = null,    // Ref — для повторного фокуса после обновления ячейки
  cacheAction = null,     // из useActionsCaching — опционально
) {
  const { updateEmptyRow, isEmptyRow, isEditableEmptyRow, emptyRowsState } = emptyRowsHelpers;

  // ── Счётчик подавления сброса скролла ────────────────────────────────────
  // saveCellUpdate вызывает skipScroll() перед lineItems.value = [...].
  // watch(lineItems) в TanTable.vue вызывает consumeSkip() вместо ручного счётчика.
  let _skipCount = 0;
  const skipScroll  = (n = 1) => { _skipCount += n; };
  const consumeSkip = () => { const v = _skipCount > 0; if (v) _skipCount--; return v; };

  // ── Map rowKey → Promise<realId> (concurrent-safe insert) ────────────────
  const _insertPromises = new Map();

  // ── Dialog state ─────────────────────────────────────────────────────────
  const lineItem              = ref({});
  const submitted             = ref(false);
  const lineItemDialog        = ref(false);
  const deleteLineItemDialog  = ref(false);
  const deleteLineItemsDialog = ref(false);
  const selectedlineItems     = selectedlineItemsRef || ref();
  const selectAll             = ref(false);
  const mywatch = ref({ enabled: false, fields: [], table: '', action: '' });

  // ── openNew ───────────────────────────────────────────────────────────────
  const openNew = (action) => {
    if (action.watch) {
      mywatch.value = {
        enabled: true,
        fields: action.watch,
        table: props.table,
        action: action.action,
        filters: prepFilters(),
      };
    }
    lineItem.value = {};
    submitted.value = false;
    lineItemDialog.value = true;
  };

  // ── editLineItem ──────────────────────────────────────────────────────────
  const editLineItem = (item, action) => {
    if (action.watch) {
      mywatch.value = {
        enabled: true,
        fields: action.watch,
        table: props.table,
        action: action.action,
        filters: prepFilters(),
      };
    }
    lineItem.value = { ...item };
    lineItemDialog.value = true;
  };

  // ── hideDialog ────────────────────────────────────────────────────────────
  const hideDialog = () => {
    lineItemDialog.value = false;
    submitted.value = false;
  };

  // ── saveLineItem (диалог создания/редактирования) ─────────────────────────
  const saveLineItem = async () => {
    submitted.value = true;
    const params = { filters: prepFilters(), update_from_modal: 1 };

    if (lineItem.value.id) {
      try {
        const dataBefore = { ...lineItem.value };
        const response = await api.update(lineItem.value, params);
        if (!response.success) notify('error', { detail: response.message }, true);
        emit('get-response', { table: props.table, action: 'update', response });
        if (response.data.customFields) {
          customFields.value[lineItem.value.id] = response.data.customFields[lineItem.value.id];
        }
        if (response.data.refresh_row == 1) lineItem.value = response.data.object;
        if (response.data.refresh_table == 1) {
          skipScroll();
          refresh(false);
        } else {
          const idx = findIndexById(Number(lineItem.value.id));
          if (idx >= 0) {
            const updated = [...lineItems.value];
            updated[idx] = lineItem.value;
            skipScroll();
            lineItems.value = updated;
          }
        }
        cacheAction?.({ type: 'update', id: dataBefore.id, source: 'modal', dataBefore, dataAfter: response.data?.object ?? lineItem.value });
        lineItemDialog.value = false;
        lineItem.value = {};
      } catch (e) {
        notify('error', { detail: e.message });
      }
    } else {
      try {
        const response = await api.create(lineItem.value, params);
        emit('get-response', { table: props.table, action: 'create', response });
        if (!response.success) notify('error', { detail: response.message }, true);
        skipScroll();
        refresh(false);
        lineItemDialog.value = false;
        lineItem.value = {};
      } catch (e) {
        notify('error', { detail: e.message });
      }
    }
  };

  // ── confirmDeleteLineItem / deleteLineItem ────────────────────────────────
  const confirmDeleteLineItem = (item) => {
    lineItem.value = item;
    deleteLineItemDialog.value = true;
  };

  const deleteLineItem = async () => {
    try {
      const deletedRow = { ...lineItem.value };
      await api.delete({ ids: lineItem.value.id, filters: prepFilters() });
      cacheAction?.({ type: 'delete', deletedIds: [deletedRow.id], deletedRows: [deletedRow], filters: prepFilters() });
      skipScroll();
      lineItems.value = lineItems.value.filter(v => v.id !== lineItem.value.id);
      deleteLineItemDialog.value = false;
      lineItem.value = {};
    } catch (e) {
      notify('error', { detail: e.message });
    }
  };

  // ── confirmDeleteSelected / deleteSelectedLineItems ───────────────────────
  const confirmDeleteSelected = () => {
    if (selectedlineItems.value?.length) deleteLineItemsDialog.value = true;
  };

  const deleteSelectedLineItems = async () => {
    const deletedRows = [...(selectedlineItems.value ?? [])];
    const ids = deletedRows.map(l => l.id).join(',');
    try {
      await api.delete({ ids, filters: prepFilters() });
      cacheAction?.({ type: 'delete', deletedIds: deletedRows.map(r => r.id), deletedRows, filters: prepFilters() });
      skipScroll();
      lineItems.value = lineItems.value.filter(v => !selectedlineItems.value.includes(v));
      deleteLineItemsDialog.value = false;
      selectedlineItems.value = null;
    } catch (e) {
      notify('error', { detail: e.message });
    }
  };

  // ── saveCellUpdate — TanStack inline cell edit ────────────────────────────
  const saveCellUpdate = async (data, field, newValue) => {
    const oldVal = data[field] ?? '';
    const newVal = newValue ?? '';
    if (String(oldVal) === String(newVal)) return;
    // Числовое сравнение: "1234.50" == 1234.5
    if (oldVal !== '' && newVal !== '') {
      const numOld = Number(oldVal);
      const numNew = Number(newVal);
      if (!isNaN(numOld) && !isNaN(numNew) && numOld === numNew) return;
    }

    // ── Пустая строка → insert через api.action('insert') ──────────────────
    if (isEmptyRow(data.id)) {
      if (newValue === '' || newValue === null || newValue === undefined) return;
      const rowKey = data._rowKey;

      // Concurrent: insert уже летит — ждём реальный ID, шлём update
      if (_insertPromises.has(rowKey)) {
        try {
          const realId = await _insertPromises.get(rowKey);
          if (realId) {
            await api.update(
              { id: realId, [field]: newValue, update_from_row: 1 },
              { filters: prepFilters?.() },
            );
          }
        } catch (e) { notify('error', { detail: e.message }, true); }
        return;
      }

      // Первый ввод — insert
      let resolveInsert;
      _insertPromises.set(rowKey, new Promise(resolve => { resolveInsert = resolve; }));
      try {
        const insertPayload = {};
        for (const key in data) {
          if (key !== 'id' && key !== '_rowKey' &&
              data[key] !== null && data[key] !== undefined && data[key] !== '') {
            insertPayload[key] = data[key];
          }
        }
        insertPayload[field] = newValue;
        insertPayload.filters = prepFilters?.();

        const response = await api.action('insert', insertPayload);
        emit('get-response', { table: props.table, action: 'insert', response });

        if (!response.success) {
          notify('error', { detail: response.message }, true);
          resolveInsert(null);
          return;
        }

        if (response.data?.object?.id) {
          const newObj = response.data.object;
          resolveInsert(newObj.id);
          updateEmptyRow(data.id, newObj, fieldsRef?.value ?? {});
          // Переприсвоение: TanStack видит смену ссылки, watch(lineItems) стреляет
          skipScroll();
          lineItems.value = [...lineItems.value];
          cacheAction?.({ type: 'insert', insertedId: newObj.id, insertedData: newObj, filters: prepFilters?.() });
          if (response.data?.customFields) {
            for (const key in response.data.customFields) {
              customFields.value[key] = response.data.customFields[key];
            }
          }
          if (response.data?.row_setting) {
            for (const key in response.data.row_setting) {
              row_setting.value[key] = response.data.row_setting[key];
            }
          }
          if (response.data?.refresh_table == 1) { skipScroll(3); refresh(false); }
        } else {
          resolveInsert(null);
          refresh(false);
        }
      } catch (e) {
        notify('error', { detail: e.message }, true);
        resolveInsert(null);
      } finally {
        _insertPromises.delete(rowKey);
      }
      return;
    }

    // ── Обычное обновление ────────────────────────────────────────────────
    const dataBefore = { ...lineItems.value[findIndexById(Number(data.id))] ?? data };
    const payload = { id: data.id, [field]: newValue, update_from_row: 1 };
    try {
      const response = await api.update(payload, { filters: prepFilters?.() });
      emit('get-response', { table: props.table, action: 'update', response });
      if (!response.success) { notify('error', { detail: response.message }, true); return; }

      const idx = findIndexById(Number(data.id));
      if (idx >= 0) {
        const updated = [...lineItems.value];
        if (response.data?.object) {
          updated[idx] = response.data.object;
        } else if (response.data?.defvalues) {
          updated[idx] = { ...lineItems.value[idx], ...response.data.defvalues };
        } else {
          updated[idx] = { ...lineItems.value[idx], [field]: newValue };
        }
        skipScroll();
        lineItems.value = updated;
        nextTick(() => {
          if (activeInline?.value) {
            document.querySelector('.tan-edit-div, .tan-edit-checkbox')?.focus();
          }
        });
      }

      if (response.data?.customFields) {
        for (const key in response.data.customFields) {
          customFields.value[key] = response.data.customFields[key];
        }
      }
      if (response.data?.row_setting) {
        for (const key in response.data.row_setting) {
          row_setting.value[key] = response.data.row_setting[key];
        }
      }
      const dataAfter = response.data?.object ?? { ...dataBefore, [field]: newValue };
      cacheAction?.({ type: 'update', id: data.id, field, dataBefore, dataAfter, filters: prepFilters?.() });
      if (response.data?.refresh_table == 1) { skipScroll(3); refresh(false); }
    } catch (e) {
      notify('error', { detail: e.message }, true);
    }
  };

  // ── Insert / Insert_child ─────────────────────────────────────────────────
  const Insert = async () => {
    const filters0 = (typeof prepFilters === 'function') ? prepFilters() : {};
    try {
      const response = await api.action('insert', { filters: filters0 });
      if (!response.success) notify('error', { detail: response.message }, true);
      skipScroll();
      refresh(false);
    } catch (e) {
      notify('error', { detail: e.message });
    }
  };

  const Insert_child = async (data) => {
    const filters0 = (typeof prepFilters === 'function') ? prepFilters() : {};
    try {
      const response = await api.action('insert_child', {
        [table_tree.value.parentIdField]: data[table_tree.value.idField],
        filters: filters0,
      });
      if (!response.success) notify('error', { detail: response.message }, true);
      skipScroll();
      refresh(false);
    } catch (e) {
      notify('error', { detail: e.message });
    }
  };

  // ── Row selection helpers (совместимость с usePVTableCRUD) ────────────────
  const onSelectAllChange = (event) => {
    selectAll.value = event.checked;
    selectedlineItems.value = event.checked ? lineItems.value : [];
  };
  const onRowSelect   = (totalRecords) => { selectAll.value = selectedlineItems.value.length === totalRecords; };
  const onRowUnselect = () => { selectAll.value = false; };

  return {
    // Dialog state
    lineItem,
    submitted,
    lineItemDialog,
    deleteLineItemDialog,
    deleteLineItemsDialog,
    selectedlineItems,
    selectAll,
    mywatch,

    // CRUD
    openNew,
    editLineItem,
    hideDialog,
    saveLineItem,
    confirmDeleteLineItem,
    deleteLineItem,
    confirmDeleteSelected,
    deleteSelectedLineItems,

    // TanStack inline cell edit
    saveCellUpdate,

    // Scroll suppression (использовать в watch(lineItems) TanTable.vue)
    skipScroll,
    consumeSkip,

    // Совместимость
    Insert,
    Insert_child,
    onSelectAllChange,
    onRowSelect,
    onRowUnselect,
  };
}
