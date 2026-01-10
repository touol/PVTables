import { ref, nextTick } from 'vue';
import { rowsHandler } from '../core/helpers';

// Счетчик для генерации уникальных _rowKey
let rowKeyCounter = 0;

/**
 * Composable для управления данными таблицы
 * @param {Number} emptyRowsCount - Количество пустых строк для добавления
 * @returns {Object} Методы и состояние для работы с данными
 */
export function usePVTableData(emptyRowsCount = 0) {
  const loading = ref(true);
  const totalRecords = ref(0);
  const first = ref(0);
  const lineItems = ref([]);
  const lazyParams = ref({});
  const autocompleteSettings = ref({});
  const row_setting = ref({});
  const customFields = ref({});
  const filterList = ref({});
  
  // Состояние для управления пустыми строками
  const emptyRowsState = ref({
    count: emptyRowsCount,
    editableIndex: 0, // Индекс редактируемой пустой строки (0 = первая)
    rows: [] // Массив пустых строк
  });

  /**
   * Создает пустые строки для таблицы
   * @param {Object} fields - Поля таблицы
   * @returns {Array} Массив пустых строк
   */
  const createEmptyRows = (fields) => {
    const emptyRows = [];
    for (let i = 0; i < emptyRowsState.value.count; i++) {
      const emptyRow = {};
      // Инициализируем все поля пустыми значениями
      for (let field in fields) {
        if (field === 'id') {
          emptyRow[field] = 'empty';
        } else {
          emptyRow[field] = null;
        }
      }
      // Гарантируем наличие id даже если его нет в fields
      if (!emptyRow.id) {
        emptyRow.id = 'empty';
      }
      // Добавляем стабильный _rowKey (теперь это главный ключ)
      emptyRow._rowKey = `row_${++rowKeyCounter}`;
      emptyRows.push(emptyRow);
    }
    return emptyRows;
  };

  /**
   * Создает функцию загрузки данных с сервера
   * @param {Object} api - API объект для запросов
   * @param {Object} fields - Поля таблицы
   * @param {Object} filters - Ref с фильтрами таблицы
   * @param {Function} prepFilters - Функция подготовки фильтров из usePVTableFilters
   * @param {Function} notify - Функция уведомлений
   * @returns {Function} Функция загрузки данных
   */
  const createLoadLazyData = (api, fields, filters, prepFilters, notify) => {
    return async (event) => {
      loading.value = true;
      lazyParams.value = {
        ...lazyParams.value,
        first: event?.first || first.value,
      };
      const params = {
        limit: lazyParams.value.rows,
        setTotal: 1,
        offset: lazyParams.value.first,
        multiSortMeta: lazyParams.value.multiSortMeta,
        filters: prepFilters(),
      };

      try {
        const response = await api.read(params);

        // Всегда создаем новый массив для гарантированной реактивности
        const processedRows = rowsHandler(response.data.rows, fields);
        // Добавляем _rowKey к каждой строке
        processedRows.forEach(row => {
          if (!row._rowKey) {
            row._rowKey = `row_${++rowKeyCounter}`;
          }
        });
        lineItems.value = [...processedRows];
        
        // Добавляем пустые строки если emptyRowsCount > 0
        if (emptyRowsState.value.count > 0) {
          // Создаем пустые строки только если их еще нет
          if (emptyRowsState.value.rows.length === 0) {
            emptyRowsState.value.rows = createEmptyRows(fields);
          }
          // Добавляем существующие пустые строки к данным
          lineItems.value = [...lineItems.value, ...emptyRowsState.value.rows];
        }

        if (!response.success && response.message) {
          notify('error', { detail: response.message });
        }

        if (response.data.autocomplete) {
          for (let af in response.data.autocomplete) {
            autocompleteSettings.value[af] = response.data.autocomplete[af];
          }
        }

        if (response.data.row_setting) {
          row_setting.value = response.data.row_setting;
        }

        if (response.data.customFields) {
          customFields.value = response.data.customFields;
        }

        if (response.data.filter_list) {
          filterList.value = response.data.filter_list;
        }

        totalRecords.value = response.data.total;
        loading.value = false;
      } catch (error) {
        console.log('error', error);
        notify('error', { detail: error.message });
      }
    };
  };

  /**
   * Создает обработчик пагинации
   * @param {Function} loadLazyData - Функция загрузки данных
   * @returns {Function} Обработчик пагинации
   */
  const createOnPage = (loadLazyData) => {
    return async (event) => {
      lazyParams.value = event;
      await loadLazyData(event);
    };
  };

  /**
   * Создает обработчик сортировки
   * @param {Function} loadLazyData - Функция загрузки данных
   * @returns {Function} Обработчик сортировки
   */
  const createOnSort = (loadLazyData) => {
    return async (event) => {
      lazyParams.value = event;
      await loadLazyData(event);
    };
  };

  /**
   * Поиск индекса элемента по ID
   * @param {Number} id - ID элемента
   * @returns {Number} Индекс элемента или -1
   */
  const findIndexById = (id) => {
    let index = -1;
    for (let i = 0; i < lineItems.value.length; i++) {
      if (lineItems.value[i].id == id) {
        index = i;
        break;
      }
    }
    return index;
  };

  /**
   * Обновление пустой строки после получения ID с сервера
   * @param {String} oldId - Старый ID (empty1, empty2, и т.д.)
   * @param {Object} newData - Новые данные строки с реальным ID
   * @param {Object} fields - Поля таблицы
   */
  const updateEmptyRow = (oldId, newData, fields) => {
    const index = lineItems.value.findIndex(item => item.id === oldId);
    
    if (index !== -1) {
      // Обновляем состояние пустых строк СНАЧАЛА
      const emptyIndex = emptyRowsState.value.rows.findIndex(row => row.id === oldId);
      
      if (emptyIndex !== -1) {
        // Удаляем эту пустую строку из массива пустых строк
        emptyRowsState.value.rows.splice(emptyIndex, 1);
        
        // Создаем новую пустую строку только если нужно поддерживать количество
        if (emptyRowsState.value.rows.length < emptyRowsState.value.count) {
          const newEmptyRow = {};
          for (let field in fields) {
            if (field === 'id') {
              newEmptyRow[field] = 'empty';
            } else {
              newEmptyRow[field] = null;
            }
          }
          // Гарантируем наличие id
          if (!newEmptyRow.id) {
            newEmptyRow.id = 'empty';
          }
          // Добавляем стабильный _rowKey (теперь это главный ключ)
          newEmptyRow._rowKey = `row_${++rowKeyCounter}`;
          
          // Добавляем новую пустую строку в массив пустых строк
          emptyRowsState.value.rows.push(newEmptyRow);
          
          // Добавляем новую пустую строку в lineItems
          lineItems.value.push(newEmptyRow);
        }
        
        // Первая пустая строка всегда редактируемая (индекс 0)
        emptyRowsState.value.editableIndex = 0;
      }
      
      // Сохраняем _rowKey из старой строки для предотвращения пересоздания DOM
      const oldRowKey = lineItems.value[index]._rowKey;
      
      // Добавляем _rowKey к новым данным
      if (!newData._rowKey) {
        newData._rowKey = oldRowKey || `row_${++rowKeyCounter}`;
      }
      
      // Заменяем пустую строку на реальную ПОСЛЕ обновления emptyRowsState
      lineItems.value.splice(index, 1, newData);
    }
  };

  /**
   * Проверка, является ли строка пустой
   * @param {String} id - ID строки
   * @returns {Boolean}
   */
  const isEmptyRow = (id) => {
    return typeof id === 'string' && id.startsWith('empty');
  };

  /**
   * Проверка, является ли пустая строка редактируемой
   * @param {String} rowKey - _rowKey строки
   * @returns {Boolean}
   */
  const isEditableEmptyRow = (rowKey) => {
    // Находим строку по _rowKey
    const row = emptyRowsState.value.rows.find(r => r._rowKey === rowKey);
    if (!row) return false;
    
    // Проверяем, что это пустая строка
    if (!isEmptyRow(row.id)) return false;
    
    // Находим индекс этой строки в массиве пустых строк
    const index = emptyRowsState.value.rows.findIndex(r => r._rowKey === rowKey);
    return index === emptyRowsState.value.editableIndex;
  };

  return {
    // Состояние
    loading,
    totalRecords,
    first,
    lineItems,
    lazyParams,
    autocompleteSettings,
    row_setting,
    customFields,
    filterList,
    emptyRowsState,
    
    // Фабричные методы
    createLoadLazyData,
    createOnPage,
    createOnSort,
    
    // Утилиты
    findIndexById,
    updateEmptyRow,
    isEmptyRow,
    isEditableEmptyRow
  };
}
