import { ref, watch } from 'vue';
import { FilterMatchMode, FilterOperator } from "@primevue/core/api";

/**
 * Composable для управления фильтрами таблицы
 * @param {Object} props - Пропсы компонента
 * @param {Object} fields - Поля таблицы
 * @param {Object} topFilters0 - Верхние фильтры
 * @param {Function} loadLazyData - Функция загрузки данных
 * @param {Object} dt - Ссылка на DataTable
 * @param {Object} lazyParams - Параметры ленивой загрузки
 * @returns {Object} Объект с состоянием и методами фильтрации
 */
export function usePVTableFilters(props, fields, topFilters0, loadLazyData, dt, lazyParams) {
  // Состояние фильтров
  const filters = ref();
  const topFilters = ref({});

  /**
   * Инициализация фильтров
   */
  const initFilters = () => {
    let filters0 = {};
    
    // Инициализация фильтров для полей таблицы
    for (let field in fields) {
      if (props.filters.hasOwnProperty(field)) {
        filters0[field] = props.filters[field];
      } else if (fields[field].filter) {
        filters0[field] = fields[field].filter;
      } else {
        switch (fields[field].type) {
          case 'autocomplete':
          case 'multiautocomplete':
          case 'select':
          case 'decimal':
          case 'number':
          case 'view':
            filters0[field] = {
              operator: FilterOperator.AND,
              constraints: [
                { value: null, matchMode: FilterMatchMode.EQUALS },
              ],
            };
            break;
          case 'boolean':
            filters0[field] = {
              value: null,
              matchMode: FilterMatchMode.EQUALS
            };
            break;
          case 'date':
            filters0[field] = {
              operator: FilterOperator.AND,
              constraints: [
                { value: null, matchMode: FilterMatchMode.DATE_AFTER },
                { value: null, matchMode: FilterMatchMode.DATE_BEFORE },
              ],
            };
            break;
          default:
            filters0[field] = {
              operator: FilterOperator.AND,
              constraints: [
                { value: null, matchMode: FilterMatchMode.STARTS_WITH },
              ],
            };
        }
      }
    }

    // Добавление фильтров из props, которых нет в fields
    for (let field in props.filters) {
      if (!filters0.hasOwnProperty(field)) {
        filters0[field] = props.filters[field];
      }
    }

    // Инициализация верхних фильтров
    for (let field in topFilters0) {
      const value = topFilters0[field].default ? topFilters0[field].default : null;
      filters0[field] = {
        operator: FilterOperator.AND,
        constraints: [
          { value: value, matchMode: FilterMatchMode.EQUALS },
        ],
      };
    }

    topFilters.value = JSON.parse(JSON.stringify(topFilters0));
    filters.value = filters0;
  };

  /**
   * Установка верхнего фильтра
   * @param {Object} filter - Объект фильтра
   */
  const onSetTopFilter = async (filter) => {
    filters.value[filter.field].constraints[0].value = filter.default;
    await loadLazyData();
  };

  /**
   * Подготовка фильтров для отправки на API
   * @returns {Object} Подготовленные фильтры
   */
  const prepFilters = () => {
    let filters0 = {};
    for (let field in filters.value) {
      if (filters.value[field].hasOwnProperty('constraints')) {
        if (filters.value[field].constraints[0].value !== null) {
          filters0[field] = filters.value[field];
        }
      } else {
        if (filters.value[field].value !== null) {
          filters0[field] = filters.value[field];
        }
      }
    }
    return filters0;
  };

  /**
   * Обработка события фильтрации
   * @param {Object} event - Событие фильтрации
   */
  const onFilter = async (event) => {
    await loadLazyData(event);
  };

  /**
   * Очистка всех фильтров
   */
  const clearFilter = async () => {
    initFilters();
    
    // Очистка сортировки если параметры переданы
    if (lazyParams && lazyParams.value) {
      lazyParams.value.multiSortMeta = [];
    }
    
    // Принудительно обновляем DataTable через ref если передан
    if (dt && dt.value) {
      dt.value.d_multiSortMeta = [];
    }
    
    if (loadLazyData) {
      await loadLazyData();
    }
  };

  // Наблюдение за изменениями props.filters
  watch(() => props.filters, async () => { 
    initFilters();
    await loadLazyData();
  });

  return {
    filters,
    topFilters,
    initFilters,
    onSetTopFilter,
    prepFilters,
    onFilter,
    clearFilter
  };
}
