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

    // Применяем фильтры из GET-параметра ?filters=...
    // Поддерживаемые форматы (ключи можно без кавычек — relaxed JSON):
    //   {id:1}                                                  — поле: значение
    //   {tablename:{id:1}}                                      — с неймспейсом таблицы
    //   {id:{operator:"and",constraints:[{value:[1,2],matchMode:"in"}]}}      — полный filter-объект
    //   {tablename:{id:{operator:"and",constraints:[...]}}}              — неймспейс + filter-объект
    // Дочерние таблицы (subtable/subtabs) URL-фильтры игнорируют —
    // иначе фильтр по id=N родительской таблицы перекрывает подтаблицу.
    try {
      if (props.child) throw new Error('skip url filters for child');
      const raw = new URLSearchParams(window.location.search).get('filters');
      if (raw) {
        let parsed = null;
        try { parsed = JSON.parse(raw); }
        catch {
          // relaxed: {id:3,matchMode:"in"} → оборачиваем неквотированные ключи в кавычки
          const fixed = raw.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
          try { parsed = JSON.parse(fixed); } catch { parsed = null; }
        }
        if (parsed && typeof parsed === 'object') {
          // Полный filter-объект (а не скалярное значение): есть constraints / matchMode / value
          const isFilterObj = (v) =>
            v && typeof v === 'object' && !Array.isArray(v) &&
            (Array.isArray(v.constraints) || v.hasOwnProperty('matchMode') || v.hasOwnProperty('value'));

          // Снимаем неймспейс таблицы, если задан: {tablename:{...}} → {...}
          let fieldMap = parsed;
          if (parsed[props.table] && typeof parsed[props.table] === 'object' && !Array.isArray(parsed[props.table])) {
            fieldMap = parsed[props.table];
          } else {
            // Если у root один ключ и это namespace-объект (значение — НЕ filter-объект,
            // а dict подкючей), но для другой таблицы — фильтры не наши, игнорируем.
            const rootKeys = Object.keys(parsed);
            if (rootKeys.length === 1) {
              const k = rootKeys[0];
              const v = parsed[k];
              if (v && typeof v === 'object' && !Array.isArray(v) && !isFilterObj(v)) {
                throw new Error('skip url filters: namespace mismatch');
              }
            }
          }

          for (const field in fieldMap) {
            const v = fieldMap[field];
            if (isFilterObj(v)) {
              // Нормализуем в форму с constraints (matchMode берём как есть — напр. "in")
              const constraints = Array.isArray(v.constraints)
                ? v.constraints.map((c) => ({
                    value: (c && c.value !== undefined) ? c.value : null,
                    matchMode: (c && c.matchMode) ? c.matchMode : FilterMatchMode.EQUALS,
                  }))
                : [{
                    value: v.value !== undefined ? v.value : null,
                    matchMode: v.matchMode || FilterMatchMode.EQUALS,
                  }];
              filters0[field] = { operator: v.operator || FilterOperator.AND, constraints };
            } else {
              // Скалярное значение (или массив для matchMode IN) → EQUALS
              const existing = filters0[field];
              if (existing && existing.hasOwnProperty('constraints')) {
                existing.constraints[0] = { value: v, matchMode: FilterMatchMode.EQUALS };
              } else if (existing && existing.hasOwnProperty('value')) {
                existing.value = v;
              } else {
                filters0[field] = {
                  operator: FilterOperator.AND,
                  constraints: [{ value: v, matchMode: FilterMatchMode.EQUALS }],
                };
              }
            }
          }
        }
      }
    } catch {}

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
    if (loadLazyData) {
      await loadLazyData();
    }
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
