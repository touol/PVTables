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

  // Счётчик _rowKey для новых строк из rows_delta (свой префикс, чтобы не
  // конфликтовать с row_N из usePVTableData). _rowKey — главный ключ строки,
  // на нём держится раскрытие (expand/subtabs) и реюз DOM виртуализатора.
  let _deltaRowKey = 0;

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
        // Backend может вернуть data.redirect → открываем страницу-редактор в новой вкладке.
        if (response.success && response.data?.redirect) {
          window.open(response.data.redirect, '_blank');
        }
        skipScroll();
        // Дочерняя под-таблица (наряды/материалы под строкой расчёта): обновляем ТОЛЬКО себя
        // (показать новую строку), без каскада reload на родителя — цену строки-владельца и
        // итог расчёта обновит rows_delta + refresh_price через get-response (см. бек).
        if (props.child) refresh(true);
        else refresh(false);
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
      const response = await api.delete({ ids: deletedRow.id, filters: prepFilters() });
      cacheAction?.({ type: 'delete', deletedIds: [deletedRow.id], deletedRows: [deletedRow], filters: prepFilters() });
      skipScroll();
      lineItems.value = lineItems.value.filter(v => v.id !== deletedRow.id);
      deleteLineItemDialog.value = false;
      lineItem.value = {};
      // Бек на удалении дочерней пересчитывает родителя → rows_delta + refresh_price.
      // Применяем к себе (своему scope) и пробрасываем выше (родительская строка/итог расчёта).
      emit('get-response', { table: props.table, action: 'delete', response });
      if (response?.data?.rows_delta) applyRowsDelta(response.data.rows_delta);
      else if (response?.data?.refresh_table == 1) { skipScroll(3); refresh(false); }
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
      const response = await api.delete({ ids, filters: prepFilters() });
      cacheAction?.({ type: 'delete', deletedIds: deletedRows.map(r => r.id), deletedRows, filters: prepFilters() });
      skipScroll();
      lineItems.value = lineItems.value.filter(v => !selectedlineItems.value.includes(v));
      deleteLineItemsDialog.value = false;
      selectedlineItems.value = null;
      emit('get-response', { table: props.table, action: 'delete', response });
      if (response?.data?.rows_delta) applyRowsDelta(response.data.rows_delta);
      else if (response?.data?.refresh_table == 1) { skipScroll(3); refresh(false); }
    } catch (e) {
      notify('error', { detail: e.message });
    }
  };

  // scope этой таблицы = parent_id, по которому она отфильтрована.
  // Основная таблица расчёта → 0; под-таблица детей (expand) → id её родителя
  // (берём из props.filters[parentIdField], который ставит usePVTableExpand).
  const scopeParentId = () => {
    if (!props.child) return 0;
    const field = table_tree?.value?.parentIdField || 'parent_id';
    const f = props?.filters?.[field];
    if (!f) return 0;
    if (Array.isArray(f.constraints) && f.constraints.length) return Number(f.constraints[0].value) || 0;
    if (f.value !== undefined) return Number(f.value) || 0;
    return 0;
  };

  // ── applyRowsDelta — точечное обновление строк без полной перезагрузки ─────
  // Бек (raschet_row) возвращает data.rows_delta = { upsert, delete, customFields, row_setting }.
  // upsert — строки ВСЕХ уровней пересчитанного поддерева (формат как при чтении), delete — удалённые id.
  // Каждый экземпляр таблицы берёт из дельты только свой scope (parent_id):
  //   • основная (scope=0) — мерджит затронутый корень+ссылки, прочие товары не трогает;
  //   • под-таблица детей (scope=X) — дельта несёт ПОЛНЫЙ актуальный набор детей X → заменяем целиком.
  const applyRowsDelta = (delta) => {
    if (!delta) return;
    // Дельта помечена своей таблицей. Чужим (под-вкладки нарядов/материалов под строкой
    // gsRaschetProduct) не применяем — её доставит наверх get-response к нужной таблице.
    if (delta.table && delta.table !== props.table) return;
    const upsert = Array.isArray(delta.upsert) ? delta.upsert : [];
    const delIds = new Set((Array.isArray(delta.delete) ? delta.delete : []).map(Number));

    // customFields / row_setting — по id (id уникальны во всём дереве), безопасно для всех таблиц
    if (delta.customFields) for (const k in delta.customFields) customFields.value[k] = delta.customFields[k];
    if (delta.row_setting)  for (const k in delta.row_setting)  row_setting.value[k]  = delta.row_setting[k];
    for (const id of delIds) { delete customFields.value[id]; delete row_setting.value[id]; }

    const isEmpty = (id) => (typeof isEmptyRow === 'function') && isEmptyRow(id);
    const scope = scopeParentId();
    const scopedUp = upsert.filter(r => Number(r.parent_id || 0) === scope);

    // Затронута ли эта таблица? (есть свои upsert ИЛИ удаляются её строки). Иначе дельта не про нас.
    const touchedByDelete = lineItems.value.some(r => delIds.has(Number(r.id)));
    if (scopedUp.length === 0 && !touchedByDelete) return;

    // Существующие строки по id — чтобы ОБНОВЛЯТЬ ИХ НА МЕСТЕ (Object.assign), сохраняя
    // ссылку на объект. Иначе при замене ссылки раскрытая строка (с открытой под-вкладкой
    // наряда/материала) ре-рендерится → моргание. _rowKey тоже сохраняем за объектом.
    const existingById = new Map();
    for (const r of lineItems.value) existingById.set(Number(r.id), r);
    const adopt = (fresh) => {
      const old = existingById.get(Number(fresh.id));
      if (old) {
        const rk = old._rowKey != null ? old._rowKey : fresh._rowKey;
        Object.assign(old, fresh);
        if (rk != null) old._rowKey = rk;
        return old; // та же ссылка → нет ремоунта, обновятся только изменённые ячейки
      }
      if (fresh._rowKey == null) fresh._rowKey = `rd_${fresh.id}_${++_deltaRowKey}`;
      return fresh;
    };

    if (scope !== 0) {
      // Под-таблица детей: scopedUp — полный набор детей этого родителя (sortfield ASC).
      // Пересобираем, переиспользуя существующие объекты (без моргания), + пустые строки.
      const rebuilt = scopedUp.map(adopt);
      const empties = lineItems.value.filter(r => isEmpty(r.id));
      skipScroll();
      lineItems.value = [...rebuilt, ...empties];
      return;
    }

    // Верхний уровень: мерджим по id (затронут только корень+ссылки), прочие строки не трогаем.
    const upMap = new Map(scopedUp.map(r => [Number(r.id), r]));
    const arr = [];
    for (const r of lineItems.value) {
      const id = Number(r.id);
      if (delIds.has(id)) continue;
      if (upMap.has(id)) { arr.push(adopt(upMap.get(id))); upMap.delete(id); }
      else arr.push(r);
    }
    // Оставшиеся в upMap — новые связанные товары (link_id=источник): после строки-источника; иначе перед пустыми.
    for (const r of upMap.values()) {
      const row = adopt(r);
      const srcId = Number(row.link_id) || 0;
      let idx = srcId ? arr.findIndex(x => Number(x.id) === srcId) : -1;
      if (idx >= 0) {
        arr.splice(idx + 1, 0, row);
      } else {
        const firstEmpty = arr.findIndex(x => isEmpty(x.id));
        if (firstEmpty >= 0) arr.splice(firstEmpty, 0, row);
        else arr.push(row);
      }
    }
    skipScroll();
    lineItems.value = arr;
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
          if (response.data?.rows_delta) { applyRowsDelta(response.data.rows_delta); }
      else if (response.data?.refresh_table == 1) { skipScroll(3); refresh(false); }
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
    // Нормализуем пустое значение: server-side isset($request[field]) для null
    // вернёт false и поле НЕ обновится. Передаём '' для явной очистки.
    const payload = { id: data.id, [field]: newVal, update_from_row: 1 };
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
      if (response.data?.rows_delta) { applyRowsDelta(response.data.rows_delta); }
      else if (response.data?.refresh_table == 1) { skipScroll(3); refresh(false); }
    } catch (e) {
      notify('error', { detail: e.message }, true);
    }
  };

  // ── Insert / Insert_child ─────────────────────────────────────────────────
  // Дочерняя под-таблица (наряды/материалы под строкой расчёта): НЕ каскадим reload на
  // родителя (refresh без bubble), цену строки-владельца обновит rows_delta через get-response.
  const afterInsert = (response) => {
    emit('get-response', { table: props.table, action: 'insert', response });
    skipScroll();
    if (props.child) refresh(true); // только своя таблица — без каскада на родителя (без моргания всех таблиц)
    else refresh(false);
  };

  const Insert = async () => {
    const filters0 = (typeof prepFilters === 'function') ? prepFilters() : {};
    try {
      const response = await api.action('insert', { filters: filters0 });
      if (!response.success) { notify('error', { detail: response.message }, true); return; }
      afterInsert(response);
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
      if (!response.success) { notify('error', { detail: response.message }, true); return; }
      afterInsert(response);
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

    // Применение rows_delta (в т.ч. для дельты, всплывшей от дочерней под-таблицы)
    applyRowsDelta,

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
