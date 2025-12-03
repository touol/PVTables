import { ref } from 'vue';

/**
 * Composable для CRUD операций таблицы
 * @param {Object} api - API объект для запросов
 * @param {Function} prepFilters - Функция подготовки фильтров
 * @param {Function} notify - Функция уведомлений
 * @param {Function} refresh - Функция обновления таблицы
 * @param {Object} emit - Emit функция компонента
 * @param {Object} props - Props компонента
 * @param {Object} lineItems - Реактивный массив элементов
 * @param {Function} findIndexById - Функция поиска индекса по ID
 * @param {Object} customFields - Реактивный объект кастомных полей
 * @param {Object} row_setting - Реактивный объект настроек строк
 * @param {Object} table_tree - Настройки древовидной таблицы
 * @param {Object} expandedTableTreeRows - Раскрытые строки дерева
 * @param {Object} childComponentRefs - Ссылки на дочерние компоненты
 * @returns {Object} Методы и состояние для CRUD операций
 */
export function usePVTableCRUD(
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
  table_tree,
  expandedTableTreeRows,
  childComponentRefs
) {
  const lineItem = ref({});
  const submitted = ref(false);
  const lineItemDialog = ref(false);
  const deleteLineItemDialog = ref(false);
  const deleteLineItemsDialog = ref(false);
  const selectedlineItems = ref();
  const selectAll = ref(false);
  const mywatch = ref({
    enabled: false,
    fields: [],
    table: '',
    action: ''
  });

  /**
   * Открытие диалога создания новой записи
   * @param {Object} action - Объект действия
   */
  const openNew = (action) => {
    if (action.watch) {
      mywatch.value = {
        enabled: true,
        fields: action.watch,
        table: props.table,
        action: action.action,
        filters: prepFilters()
      };
    }
    lineItem.value = {};
    submitted.value = false;
    lineItemDialog.value = true;
  };

  /**
   * Редактирование записи
   * @param {Object} item - Объект записи
   * @param {Object} action - Объект действия
   */
  const editLineItem = (item, action) => {
    if (action.watch) {
      mywatch.value = {
        enabled: true,
        fields: action.watch,
        table: props.table,
        action: action.action,
        filters: prepFilters()
      };
    }
    lineItem.value = { ...item };
    lineItemDialog.value = true;
  };

  /**
   * Скрытие диалога редактирования
   */
  const hideDialog = () => {
    lineItemDialog.value = false;
    submitted.value = false;
  };

  /**
   * Сохранение записи (создание или обновление)
   */
  const saveLineItem = async () => {
    submitted.value = true;
    const params = {
      filters: prepFilters(),
      update_from_modal: 1
    };

    if (lineItem.value.id) {
      // Обновление существующей записи
      try {
        const response = await api.update(lineItem.value, params);

        if (!response.success) {
          notify('error', { detail: response.message }, true);
        }

        emit('get-response', {
          table: props.table,
          action: 'update',
          response: response
        });

        if (response.data.customFields) {
          customFields.value[lineItem.value.id] = response.data.customFields[lineItem.value.id];
        }

        if (response.data.refresh_row == 1) {
          lineItem.value = response.data.object;
        }

        if (response.data.refresh_table == 1) {
          refresh(false);
        }

        lineItems.value[findIndexById(Number(lineItem.value.id))] = lineItem.value;
        lineItemDialog.value = false;
        lineItem.value = {};
      } catch (error) {
        console.log('error', error);
        notify('error', { detail: error.message });
      }
    } else {
      // Создание новой записи
      try {
        const response = await api.create(lineItem.value, params);

        emit('get-response', {
          table: props.table,
          action: 'create',
          response: response
        });

        if (!response.success) {
          notify('error', { detail: response.message }, true);
        }

        refresh(false);
        lineItemDialog.value = false;
        lineItem.value = {};
      } catch (error) {
        console.log('error', error);
        notify('error', { detail: error.message });
      }
    }
  };

  /**
   * Вставка новой записи
   */
  const Insert = async () => {
    try {
      const response = await api.action('insert', { filters: prepFilters() });
      if (!response.success) {
        notify('error', { detail: response.message }, true);
      }
      refresh(false);
    } catch (error) {
      console.log('error', error);
      notify('error', { detail: error.message });
    }
  };

  /**
   * Вставка дочерней записи
   * @param {Object} data - Родительская запись
   */
  const Insert_child = async (data) => {
    try {
      const response = await api.action('insert_child', {
        [table_tree.value.parentIdField]: data[table_tree.value.idField],
        filters: prepFilters()
      });

      if (!response.success) {
        notify('error', { detail: response.message }, true);
      }

      refresh(false);
    } catch (error) {
      console.log('error', error);
      notify('error', { detail: error.message });
    }
  };

  /**
   * Подтверждение удаления записи
   * @param {Object} item - Запись для удаления
   */
  const confirmDeleteLineItem = (item) => {
    lineItem.value = item;
    deleteLineItemDialog.value = true;
  };

  /**
   * Удаление записи
   */
  const deleteLineItem = async () => {
    try {
      await api.delete({ ids: lineItem.value.id });

      lineItems.value = lineItems.value.filter(
        (val) => val.id !== lineItem.value.id
      );

      deleteLineItemDialog.value = false;
      lineItem.value = {};
    } catch (error) {
      console.log('error', error);
      notify('error', { detail: error.message });
    }
  };

  /**
   * Подтверждение удаления выбранных записей
   */
  const confirmDeleteSelected = () => {
    if (selectedlineItems.value && selectedlineItems.value.length) {
      deleteLineItemsDialog.value = true;
    }
  };

  /**
   * Удаление выбранных записей
   */
  const deleteSelectedLineItems = async () => {
    const ids = selectedlineItems.value.map((line) => line.id).join(',');

    try {
      await api.delete({ ids });

      lineItems.value = lineItems.value.filter(
        (val) => !selectedlineItems.value.includes(val)
      );

      deleteLineItemsDialog.value = false;
      selectedlineItems.value = null;
    } catch (error) {
      console.log('error', error);
      notify('error', { detail: error.message });
    }
  };

  /**
   * Редактирование ячейки
   * @param {Object} event - Событие редактирования
   */
  const onCellEditComplete = async (event) => {
    let { data, newValue, field } = event;
    if (!field) return;

    // Вспомогательные функции для работы с вложенными полями
    const getField = (obj, field) => {
      return field.split('.').reduce((acc, curr) => acc[curr], obj);
    };

    const setField = (obj, field, value) => {
      const fields = field.split('.');
      const lastField = fields.pop();
      let target = obj;
      for (let i = 0; i < fields.length; i++) {
        if (!target[fields[i]]) {
          target[fields[i]] = {};
        }
        target = target[fields[i]];
      }
      target[lastField] = value;
    };

    if (getField(data, field) == newValue) return;

    const payload = {
      id: data.id,
      [field]: newValue,
      update_from_row: 1
    };

    try {
      const response = await api.update(payload, { filters: prepFilters() });

      emit('get-response', {
        table: props.table,
        action: 'update',
        response: response
      });

      setField(data, field, newValue);

      if (!response.success) {
        notify('error', { detail: response.message }, true);
      }

      if (response.data.refresh_table == 1) {
        refresh(false);
      }

      if (response.data.customFields) {
        for (let key in response.data.customFields) {
          customFields.value[key] = response.data.customFields[key];
        }
      }

      if (response.data.object) {
        lineItems.value[findIndexById(Number(payload.id))] = response.data.object;
      } else if (response.data.defvalues) {
        lineItems.value[findIndexById(Number(payload.id))] = {
          ...lineItems.value[findIndexById(Number(payload.id))],
          ...response.data.defvalues
        };
      }

      if (response.data.row_setting) {
        for (let key in response.data.row_setting) {
          row_setting.value[key] = response.data.row_setting[key];
        }
      }

      if (expandedTableTreeRows.value[data.id]) {
        if (data['gtsapi_children_count'] == 0) {
          // Вызов toogleExpandRow должен быть передан извне
        } else {
          childComponentRefs.value[data.id].refresh(true);
        }
      }
    } catch (error) {
      console.log('error', error);
      notify('error', { detail: error.message }, true);
    }
  };

  /**
   * Обработчик выбора всех записей
   * @param {Object} event - Событие выбора
   */
  const onSelectAllChange = (event) => {
    selectAll.value = event.checked;

    if (selectAll.value) {
      selectAll.value = true;
      selectedlineItems.value = lineItems.value;
    } else {
      selectAll.value = false;
      selectedlineItems.value = [];
    }
  };

  /**
   * Обработчик выбора строки
   */
  const onRowSelect = (totalRecords) => {
    selectAll.value = selectedlineItems.value.length === totalRecords;
  };

  /**
   * Обработчик отмены выбора строки
   */
  const onRowUnselect = () => {
    selectAll.value = false;
  };

  return {
    lineItem,
    submitted,
    lineItemDialog,
    deleteLineItemDialog,
    deleteLineItemsDialog,
    selectedlineItems,
    selectAll,
    mywatch,
    openNew,
    editLineItem,
    hideDialog,
    saveLineItem,
    Insert,
    Insert_child,
    confirmDeleteLineItem,
    deleteLineItem,
    confirmDeleteSelected,
    deleteSelectedLineItems,
    onCellEditComplete,
    onSelectAllChange,
    onRowSelect,
    onRowUnselect
  };
}
