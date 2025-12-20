import { ref } from 'vue';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';

/**
 * Composable для управления раскрытием строк таблицы
 * @param {Object} table_tree - Настройки древовидной таблицы
 * @param {Function} filters - Функция, возвращающая фильтры таблицы
 * @param {Object} dataFields - Поля данных
 * @param {String} tableName - Имя таблицы
 * @returns {Object} Методы и состояние для работы с раскрытием строк
 */
export function usePVTableExpand(table_tree, filters, dataFields, tableName) {
  const expandedRows = ref({});
  const expandedTableTreeRows = ref({});
  const subs = ref({});
  const subfilters = ref({});
  const parent_row = ref({});
  const childComponentRefs = ref({});

  /**
   * Обрабатывает модификаторы полей в where-условиях
   * @param {String} field - Имя поля с возможным модификатором
   * @param {Any} value - Значение для фильтра
   * @param {Object} event - Данные строки
   * @returns {Object} Объект с fieldName, matchMode и filterValue
   */
  const processFieldModifier = (field, value, event) => {
    const fieldParts = field.split(':');
    const fieldName = fieldParts[0];
    const modifier = fieldParts[1];

    let filterValue = value;
    let matchMode = FilterMatchMode.EQUALS;

    // Проверяем, является ли значение полем из data_fields
    if (dataFields.value && dataFields.value.includes(value)) {
      const dataFieldsValues = getDataFieldsValues(event);
      if (dataFieldsValues[value]) {
        try {
          filterValue = typeof dataFieldsValues[value] === 'string'
            ? JSON.parse(dataFieldsValues[value])
            : dataFieldsValues[value];
        } catch (e) {
          filterValue = dataFieldsValues[value];
        }
      }
    }

    if (modifier) {
      switch (modifier.toUpperCase()) {
        case 'IN':
          matchMode = FilterMatchMode.IN;
          if (!Array.isArray(filterValue)) {
            filterValue = filterValue ? [filterValue] : [];
          }
          break;
        case 'LIKE':
          matchMode = FilterMatchMode.CONTAINS;
          break;
        case 'NOT LIKE':
          matchMode = FilterMatchMode.NOT_CONTAINS;
          break;
        case '!=':
          matchMode = FilterMatchMode.NOT_EQUALS;
          break;
        case '<':
          matchMode = FilterMatchMode.LESS_THAN;
          break;
        case '<=':
          matchMode = FilterMatchMode.LESS_THAN_OR_EQUAL_TO;
          break;
        case '>':
          matchMode = FilterMatchMode.GREATER_THAN;
          break;
        case '>=':
          matchMode = FilterMatchMode.GREATER_THAN_OR_EQUAL_TO;
          break;
        default:
          matchMode = FilterMatchMode.EQUALS;
      }
    }

    return { fieldName, matchMode, filterValue };
  };

  /**
   * Получение значений data_fields для строки
   * @param {Object} data - Данные строки
   * @returns {Object} Объект со значениями data_fields
   */
  const getDataFieldsValues = (data) => {
    if (!dataFields.value || dataFields.value.length === 0) {
      return {};
    }
    let result = {};
    dataFields.value.forEach(field => {
      if (data.hasOwnProperty(field)) {
        result[field] = data[field];
      }
    });
    return result;
  };

  /**
   * Удаление раскрытия строк
   * @param {Object} tmp - Объект раскрытых строк
   */
  const delExpand = async (tmp) => {
    expandedRows.value = { ...tmp };
    parent_row.value = {};
  };

  /**
   * Переключение раскрытия строки в древовидной таблице
   * @param {Object} data - Данные строки
   */
  const toogleExpandRow = async (data) => {

    // Проверяем наличие table_tree
    if (!table_tree || !table_tree.value) {
      console.error('table_tree is not defined');
      return;
    }

    let tmp = { ...expandedRows.value };
    
    if (expandedTableTreeRows.value[data.id]) {
      delete expandedTableTreeRows.value[data.id];
      delete tmp[data.id];
      await delExpand(tmp);
      delete subs.value[data.id];
    } else {
      let tmpfilters = {};
      delete tmp[data.id];
      await delExpand(tmp);

      tmpfilters[table_tree.value.parentIdField] = {
        operator: FilterOperator.AND,
        constraints: [
          {
            value: data[table_tree.value.idField],
            matchMode: FilterMatchMode.EQUALS,
          },
        ],
      };

      // Получаем текущие фильтры через функцию
      const currentFilters = (typeof filters === 'function' && filters()) ? filters().value : {};
      subfilters.value[data.id] = { ...currentFilters, ...tmpfilters };

      subs.value[data.id] = {
        action: 'subtables',
        table: tableName,
      };

      tmp[data.id] = true;
      expandedTableTreeRows.value[data.id] = true;
      expandedRows.value = { ...tmp };
    }
  };

  /**
   * Установка раскрытия строки для подтаблиц или подвкладок
   * @param {Object} event - Данные строки
   * @param {Object} tmpt - Конфигурация действия
   */
  const setExpandedRow = async (event, tmpt) => {
    let tmp = { ...expandedRows.value };

    if (tmp.hasOwnProperty(event.id)) {
      if (subs.value[event.id].table == tmpt.table) {
        delete tmp[event.id];
        await delExpand(tmp);
        return;
      } else {
        delete tmp[event.id];
        await delExpand(tmp);
        tmp[event.id] = true;
      }
    } else {
      tmp[event.id] = true;
    }
    
    subs.value[event.id] = tmpt;

    if (tmpt.action == 'subtables') {
      if (tmpt.hasOwnProperty('where')) {
        let tmpfilters = {};
        for (let field in tmpt.where) {
          const value = event[tmpt.where[field]] || tmpt.where[field];
          const { fieldName, matchMode, filterValue } = processFieldModifier(field, value, event);

          tmpfilters[fieldName] = {
            operator: FilterOperator.AND,
            constraints: [
              {
                value: filterValue,
                matchMode: matchMode,
              },
            ],
          };
        }
        subfilters.value[event.id] = tmpfilters;
      }
    } else if (tmpt.action == 'subtabs') {
      for (let key in tmpt.tabs) {
        if (tmpt.tabs[key].hasOwnProperty('where')) {
          let tmpfilters = {};
          for (let field in tmpt.tabs[key].where) {
            const value = event[tmpt.tabs[key].where[field]]
              ? event[tmpt.tabs[key].where[field]]
              : tmpt.tabs[key].where[field];

            const { fieldName, matchMode, filterValue } = processFieldModifier(field, value, event);

            tmpfilters[fieldName] = {
              operator: FilterOperator.AND,
              constraints: [
                {
                  value: filterValue,
                  matchMode: matchMode,
                },
              ],
            };
          }
          
          if (!subfilters.value.hasOwnProperty(event.id)) {
            subfilters.value[event.id] = {};
          }
          subfilters.value[event.id][key] = tmpfilters;
          parent_row.value = { ...event };
        }
      }
    }
    
    expandedRows.value = { ...tmp };
  };

  return {
    expandedRows,
    expandedTableTreeRows,
    subs,
    subfilters,
    parent_row,
    childComponentRefs,
    toogleExpandRow,
    setExpandedRow,
    delExpand
  };
}
