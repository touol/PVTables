import { ref } from 'vue';

/**
 * Composable для управления стилями таблицы
 * @param {Object} row_setting - Настройки строк
 * @param {Object} row_class_trigger - Триггеры классов строк
 * @param {Object} customFields - Кастомные поля
 * @param {Object} hideId - Флаг скрытия ID
 * @returns {Object} Методы для работы со стилями
 */
export function usePVTableStyles(row_setting, row_class_trigger, customFields, hideId) {
  const op = ref();
  const selectedColumns = ref();
  const darkTheme = ref(false);

  /**
   * Переключение темной темы
   */
  const toggleDarkMode = () => {
    const element = document.querySelector('html');
    darkTheme.value = !darkTheme.value;
    element.classList.toggle('my-app-dark');
  };

  /**
   * Получение класса для тела ячейки
   * @param {Object} col - Колонка
   * @param {Object} data - Данные строки
   * @returns {String} Класс для ячейки
   */
  const getClassBody = (col, data) => {
    let class1 = 'td-body ';
    let class2 = col.type;
    let customReadonly = false;
    
    if (customFields.value[data.id]) {
      if (customFields.value[data.id][col.field]) {
        if (customFields.value[data.id][col.field].readonly == 1) {
          customReadonly = true;
        }
        if (customFields.value[data.id][col.field].type != class2) {
          class2 = customFields.value[data.id][col.field].type;
        }
      }
    }
    
    if (col.readonly || customReadonly) {
      return class1 + class2 + ' readonly';
    }
    return class1 + class2;
  };

  /**
   * Получение класса для TD
   * @param {Object} col - Колонка
   * @returns {String} Класс для TD
   */
  const getClassTD = (col) => {
    return col.type;
  };

  /**
   * Получение стиля для колонки
   * @param {Object} col - Колонка
   * @returns {Object} Объект стилей
   */
  const getColumnStyle = (col) => {
    let style = {};

    if (col.style) {
      style = typeof col.style === 'string' ? {} : { ...col.style };
    }

    if (col.width) {
      style.width = col.width;
    }
    if (col['min-width']) {
      style['min-width'] = col['min-width'];
    }

    if (Object.keys(style).length === 0 && col.type === 'datetime') {
      style['min-width'] = '190px';
    }
    if (Object.keys(style).length === 0 && col.type === 'textarea') {
      style['min-width'] = '190px';
    }

    return style;
  };

  /**
   * Получение класса для строки
   * @param {Object} data - Данные строки
   * @returns {String|undefined} Класс строки
   */
  const rowClass = (data) => {
    if (row_setting.value[data.id] && row_setting.value[data.id].class) {
      return row_setting.value[data.id].class;
    }
    if (row_class_trigger.value.field) {
      if (data[row_class_trigger.value.field]) {
        return row_class_trigger.value.class;
      }
    }
    return;
  };

  /**
   * Базовый стиль строки (без виртуального скроллинга)
   * @param {Object} data - Данные строки
   * @returns {Object} Объект стилей
   */
  const baseRowStyle = (data) => {
    if (row_setting.value[data.id] && row_setting.value[data.id].style) {
      const style = row_setting.value[data.id].style;
      if (style && typeof style === 'object' && !Array.isArray(style)) {
        return style;
      }
    }
    return {};
  };

  /**
   * Переключение настроек колонок
   * @param {Event} event - Событие
   * @param {Array} columns - Колонки таблицы
   */
  const toggleSettings = (event, columns) => {
    selectedColumns.value = columns.value.filter(col => col.modal_only != true);
    op.value.toggle(event);
  };

  /**
   * Обработчик переключения колонок
   * @param {Array} val - Выбранные колонки
   * @param {Array} columns - Все колонки
   */
  const onToggleColomns = (val, columns) => {
    columns.value.forEach(col => {
      if (val.includes(col)) {
        col.modal_only = false;
      } else {
        col.modal_only = true;
      }
    });
    selectedColumns.value = columns.value.filter(col => col.modal_only != true);
  };

  return {
    op,
    selectedColumns,
    darkTheme,
    toggleDarkMode,
    getClassBody,
    getClassTD,
    getColumnStyle,
    rowClass,
    baseRowStyle,
    toggleSettings,
    onToggleColomns
  };
}
