import { ref } from 'vue';
import { rowsHandler } from '../core/helpers';

/**
 * Composable для управления данными таблицы
 * @returns {Object} Методы и состояние для работы с данными
 */
export function usePVTableData() {
  const loading = ref(true);
  const totalRecords = ref(0);
  const first = ref(0);
  const lineItems = ref([]);
  const lazyParams = ref({});
  const autocompleteSettings = ref({});
  const row_setting = ref({});
  const customFields = ref({});
  const filterList = ref({});

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
        lineItems.value = [...rowsHandler(response.data.rows, fields)];

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
    
    // Фабричные методы
    createLoadLazyData,
    createOnPage,
    createOnSort,
    
    // Утилиты
    findIndexById
  };
}
