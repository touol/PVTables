import { ref, watch, onBeforeUnmount } from 'vue';

/**
 * Composable для управления стилями таблицы
 * @param {Object} row_setting - Настройки строк
 * @param {Object} row_class_trigger - Триггеры классов строк
 * @param {Object} customFields - Кастомные поля
 * @param {Object} hideId - Флаг скрытия ID
 * @param {Object} api - API для работы с сервером
 * @param {String} table - Название таблицы
 * @param {Function} notify - Функция уведомлений
 * @param {Object} props - Props компонента (для scrollHeight и autoFitHeight)
 * @param {Object} dt - Ref на DataTable компонент
 * @returns {Object} Методы для работы со стилями
 */
export function usePVTableStyles(row_setting, row_class_trigger, customFields, hideId, api = null, table = '', notify = null, props = null, dt = null) {
  const op = ref(null);
  const selectedColumns = ref();
  const darkTheme = ref(false);
  const serverFieldsStyle = ref(null);
  
  // Управление высотой таблицы
  const tableScrollHeight = ref(props?.scrollHeight || '85vh');
  const autoFitHeight = ref(props?.autoFitHeight || false);
  
  // Управление размером шрифта
  const fontSize = ref(13);
  
  // Загружаем сохраненный размер шрифта
  const savedFontSize = localStorage.getItem('pvtables-font-size');
  if (savedFontSize) {
    const size = parseInt(savedFontSize);
    if (size >= 10 && size <= 20) {
      fontSize.value = size;
      document.documentElement.style.fontSize = `${size}px`;
    }
  }
  
  // Режим растягивания таблицы
  const stretchTableMode = ref(false);
  
  // Загрузка сохраненного значения из localStorage
  const savedStretchMode = localStorage.getItem(`pvtables-${table}-stretch-mode`);
  if (savedStretchMode !== null) {
    stretchTableMode.value = savedStretchMode === 'true';
  }
  
  // Режим отключения вертикального скролла
  const disableVerticalScroll = ref(false);
  let savedScrollHeight = null; // Для сохранения значения высоты при переключении режима
  
  // Загрузка сохраненного значения из localStorage
  const savedDisableScroll = localStorage.getItem(`pvtables-${table}-disable-vscroll`);
  if (savedDisableScroll !== null) {
    disableVerticalScroll.value = savedDisableScroll === 'true';
    // Если режим был включен, сразу устанавливаем null для высоты
    if (disableVerticalScroll.value) {
      savedScrollHeight = tableScrollHeight.value;
      tableScrollHeight.value = null;
    }
  }

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
      
      // Если style - это объект, возвращаем его как есть
      if (style && typeof style === 'object' && !Array.isArray(style)) {
        return style;
      }
      
      // Если style - это строка, парсим её в объект
      if (typeof style === 'string') {
        const styleObj = {};
        // Разбиваем строку по точке с запятой
        style.split(';').forEach(rule => {
          const trimmedRule = rule.trim();
          if (trimmedRule) {
            const colonIndex = trimmedRule.indexOf(':');
            if (colonIndex > 0) {
              const property = trimmedRule.substring(0, colonIndex).trim();
              const value = trimmedRule.substring(colonIndex + 1).trim();
              // Преобразуем CSS свойство в camelCase для Vue
              const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
              styleObj[camelProperty] = value;
            }
          }
        });
        return styleObj;
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

  // Style элемент для применения ширины колонок
  let columnWidthStyleElement = null;
  
  /**
   * Создание style элемента для ширины колонок
   */
  const createColumnWidthStyleElement = () => {
    if (!columnWidthStyleElement) {
      columnWidthStyleElement = document.createElement('style');
      columnWidthStyleElement.type = 'text/css';
      columnWidthStyleElement.id = `pvtables-column-widths-${table}`;
      document.head.appendChild(columnWidthStyleElement);
    }
  };
  
  /**
   * Уничтожение style элемента для ширины колонок
   */
  const destroyColumnWidthStyleElement = () => {
    if (columnWidthStyleElement) {
      document.head.removeChild(columnWidthStyleElement);
      columnWidthStyleElement = null;
    }
  };
  
  /**
   * Применение стилей колонок из localStorage или с сервера
   * Использует динамический <style> элемент, как в resizeTableCells
   * @param {Array} columns - Колонки таблицы
   * @param {String} attributeSelector - Селектор атрибута таблицы
   */
  const applyColumnWidths = (columns, attributeSelector = null) => {
    if (!table) return;
    
    // Приоритет: локальные → серверные → дефолтные
    const localStyles = localStorage.getItem(`pvtables-${table}-column-widths`);
    
    let stylesToApply = null;
    let tableWidth = null;
    
    if (localStyles) {
      try {
        const parsed = JSON.parse(localStyles);
        // Поддержка старого и нового формата
        if (parsed.columnWidths) {
          stylesToApply = parsed.columnWidths;
          tableWidth = parsed.tableWidth;
        } else {
          stylesToApply = parsed;
        }
      } catch (e) {
        console.error('Ошибка парсинга локальных стилей:', e);
      }
    } else if (serverFieldsStyle.value) {
      if (serverFieldsStyle.value.columnWidths) {
        stylesToApply = serverFieldsStyle.value.columnWidths;
        tableWidth = serverFieldsStyle.value.tableWidth;
      } else {
        stylesToApply = serverFieldsStyle.value;
      }
    }
    
    if (!stylesToApply || !columns.value) {
      destroyColumnWidthStyleElement();
      return;
    }
    
    // Создаем массив стилей с domIndex
    const columnStyles = [];
    columns.value.forEach(col => {
      if (stylesToApply[col.field]) {
        const styleData = stylesToApply[col.field];
        if (styleData.width && styleData.domIndex) {
          columnStyles.push({
            domIndex: styleData.domIndex,
            width: parseInt(styleData.width)
          });
        }
      }
    });
    
    // Применяем стили через динамический <style> элемент
    setTimeout(() => {
      addColumnWidthStyles(columnStyles, attributeSelector, tableWidth);
    }, 100);
  };
  
  /**
   * Добавление стилей ширины колонок через динамический <style> элемент
   * Аналогично методу addColumnWidthStyles из DataTable
   * @param {Array} columnStyles - Массив объектов {domIndex, width}
   * @param {String} attributeSelector - Селектор атрибута таблицы
   * @param {String} tableWidth - Ширина таблицы
   */
  const addColumnWidthStyles = (columnStyles, attributeSelector, tableWidth = null) => {
    destroyColumnWidthStyleElement();
    createColumnWidthStyleElement();
    
    let innerHTML = '';
    const selector = attributeSelector 
      ? `[data-pc-name="datatable"][${attributeSelector}] > [data-pc-section="tablecontainer"] > table[data-pc-section="table"]`
      : `[data-pc-name="datatable"] > [data-pc-section="tablecontainer"] > table[data-pc-section="table"]`;
    
    // Применяем ширину таблицы если есть
    if (tableWidth) {
      innerHTML += `
        ${selector} {
          width: ${tableWidth};
          min-width: ${tableWidth};
        }
      `;
    }
    
    // Применяем стили для каждой колонки используя сохраненный domIndex
    columnStyles.forEach(({domIndex, width}) => {
      const style = `width: ${width}px !important; max-width: ${width}px !important`;
      
      innerHTML += `
        ${selector} > thead[data-pc-section="thead"] > tr > th:nth-child(${domIndex}),
        ${selector} > tbody[data-pc-section="tbody"] > tr > td:nth-child(${domIndex}),
        ${selector} > tfoot[data-pc-section="tfoot"] > tr > td:nth-child(${domIndex}) {
          ${style}
        }
      `;
    });
    
    columnWidthStyleElement.innerHTML = innerHTML;
  };

  /**
   * Сохранение ширины колонок и таблицы в localStorage
   * @param {HTMLElement} tableElement - DOM элемент таблицы
   * @param {Array} columns - Колонки таблицы
   */
  const saveColumnWidthsToLocal = (tableElement, columns) => {
    if (!table || !tableElement || !columns.value) return;
    
    const headers = tableElement.querySelectorAll('thead th');
    const widths = {};
    
    // Создаем карту label -> column для сопоставления
    const columnsByLabel = {};
    columns.value.forEach(col => {
      columnsByLabel[col.label] = col;
    });
    
    headers.forEach((header, domIndex) => {
      const headerText = header.textContent?.trim();
      
      // Находим колонку по label (тексту заголовка)
      const matchedColumn = columnsByLabel[headerText];
      
      if (matchedColumn && matchedColumn.field) {
        widths[matchedColumn.field] = {
          width: `${header.offsetWidth}px`,
          domIndex: domIndex + 1 // nth-child начинается с 1
        };
      }
    });
    
    // Сохраняем также общую ширину таблицы
    const tableWidth = tableElement.offsetWidth;
    
    const styleData = {
      columnWidths: widths,
      tableWidth: `${tableWidth}px`
    };
    
    localStorage.setItem(`pvtables-${table}-column-widths`, JSON.stringify(styleData));
  };

  /**
   * Сохранение стилей на сервере
   */
  const saveFieldsStyleToServer = async () => {
    if (!api || !table || !notify) {
      console.warn('API, table или notify не предоставлены для сохранения стилей');
      return;
    }
    
    const localStyles = localStorage.getItem(`pvtables-${table}-column-widths`);
    if (!localStyles) {
      notify('warning', { detail: 'Нет локальных стилей для сохранения' });
      return;
    }
    
    try {
      const response = await api.action('save_fields_style', {
        fields_style: JSON.parse(localStyles)
      });
      
      if (response.success) {
        serverFieldsStyle.value = JSON.parse(localStyles);
        notify('success', { detail: 'Стили сохранены на сервере' });
      } else {
        notify('error', { detail: response.data.message || 'Ошибка сохранения стилей' });
      }
    } catch (error) {
      console.error('Ошибка сохранения стилей:', error);
      notify('error', { detail: 'Ошибка сохранения стилей на сервере' });
    }
  };

  /**
   * Сброс локальных стилей
   * @param {Function} refresh - Функция обновления таблицы
   */
  const resetLocalFieldsStyle = (refresh = null) => {
    if (!table || !notify) return;
    
    localStorage.removeItem(`pvtables-${table}-column-widths`);
    notify('success', { detail: 'Локальные стили сброшены' });
    
    if (refresh) {
      refresh(false);
    }
  };

  /**
   * Сброс стилей на сервере
   * @param {Function} refresh - Функция обновления таблицы
   */
  const resetServerFieldsStyle = async (refresh = null) => {
    if (!api || !table || !notify) {
      console.warn('API, table или notify не предоставлены для сброса стилей');
      return;
    }
    
    try {
      const response = await api.action('reset_fields_style', {});
      
      if (response.success) {
        serverFieldsStyle.value = null;
        notify('success', { detail: 'Стили на сервере сброшены' });
        
        if (refresh) {
          refresh(false);
        }
      } else {
        notify('error', { detail: response.data.message || 'Ошибка сброса стилей' });
      }
    } catch (error) {
      console.error('Ошибка сброса стилей:', error);
      notify('error', { detail: 'Ошибка сброса стилей на сервере' });
    }
  };

  /**
   * Загрузка стилей с сервера
   * @param {Object} optionsData - Данные options с сервера
   */
  const loadServerFieldsStyle = (optionsData) => {
    if (optionsData && optionsData.fields_style) {
      serverFieldsStyle.value = optionsData.fields_style;
    }
  };

  /**
   * Расчет высоты таблицы для автоматической подгонки под экран
   */
  const calculateTableHeight = () => {
    if (!autoFitHeight.value || !dt || !dt.value) return;
    
    setTimeout(() => {
      try {
        const dataTableEl = dt.value.$el;
        if (!dataTableEl) return;
        
        // Получаем высоту окна
        const windowHeight = window.innerHeight;
        
        // Получаем позицию начала таблицы относительно viewport
        const tableRect = dataTableEl.getBoundingClientRect();
        const tableTop = tableRect.top;
        
        // Находим элементы заголовка и пагинатора внутри DataTable
        const tableHeader = dataTableEl.querySelector('.p-datatable-header');
        const tablePaginator = dataTableEl.querySelector('.p-paginator');
        
        // Получаем высоты элементов
        const headerHeight = tableHeader ? tableHeader.offsetHeight : 0;
        const paginatorHeight = tablePaginator ? tablePaginator.offsetHeight : 0;
        
        // Резервируем немного места снизу (отступ)
        const bottomPadding = 20;
        
        // Рассчитываем доступную высоту для скроллируемой области
        const availableHeight = windowHeight - tableTop - headerHeight - paginatorHeight - bottomPadding;
        
        // Устанавливаем высоту (минимум 200px)
        const calculatedHeight = Math.max(200, availableHeight);
        tableScrollHeight.value = `${calculatedHeight}px`;
      } catch (error) {
        console.error('Error calculating table height:', error);
      }
    }, 100);
  };
  
  /**
   * Обработчик переключения auto-fit высоты
   */
  const onAutoFitHeightToggle = () => {
    if (autoFitHeight.value) {
      calculateTableHeight();
      // Пересчитываем при изменении размера окна
      window.addEventListener('resize', calculateTableHeight);
    } else {
      tableScrollHeight.value = props?.scrollHeight || '85vh';
      window.removeEventListener('resize', calculateTableHeight);
    }
  };
  
  /**
   * Обработчик изменения размера шрифта
   * @param {Number} value - Новый размер шрифта
   */
  const onFontSizeChange = (value) => {
    if (value && value >= 10 && value <= 20) {
      document.documentElement.style.fontSize = `${value}px`;
      localStorage.setItem('pvtables-font-size', value.toString());
    }
  };
  
  /**
   * Обработчик переключения режима растягивания таблицы
   */
  const onStretchTableModeToggle = () => {
    // Сохраняем в localStorage
    localStorage.setItem(`pvtables-${table}-stretch-mode`, stretchTableMode.value.toString());
    
    // Применяем или убираем стили растягивания
    // Используем setTimeout чтобы дать таблице отрендериться
    setTimeout(() => {
      applyStretchTableStyles();
    }, 100);
    
    // Уведомление пользователя
    if (notify) {
      const message = stretchTableMode.value
        ? 'Режим растягивания включен. Теперь можно масштабировать таблицу на мобильных устройствах.'
        : 'Режим растягивания выключен.';
      notify('info', { detail: message });
    }
  };
  
  /**
   * Обработчик переключения режима отключения вертикального скролла
   */
  const onDisableVerticalScrollToggle = () => {
    // Сохраняем в localStorage
    localStorage.setItem(`pvtables-${table}-disable-vscroll`, disableVerticalScroll.value.toString());
    
    // Управление высотой таблицы
    if (disableVerticalScroll.value) {
      // При включении режима - убираем ограничение по высоте
      savedScrollHeight = tableScrollHeight.value; // Сохраняем текущее значение
      tableScrollHeight.value = null;
    } else {
      // При выключении - восстанавливаем сохраненное значение
      tableScrollHeight.value = savedScrollHeight || props?.scrollHeight || '85vh';
    }
    
    // Применяем стили для вертикального скролла
    applyVerticalScrollStyles();
    
    // Уведомление пользователя
    if (notify) {
      const message = disableVerticalScroll.value
        ? 'Вертикальный скролл отключен.'
        : 'Вертикальный скролл включен.';
      notify('info', { detail: message });
    }
  };
  
  // Style элемент для режима растягивания
  let stretchTableStyleElement = null;
  
  /**
   * Создание style элемента для режима растягивания
   */
  const createStretchTableStyleElement = () => {
    if (!stretchTableStyleElement) {
      stretchTableStyleElement = document.createElement('style');
      stretchTableStyleElement.type = 'text/css';
      stretchTableStyleElement.id = `pvtables-stretch-mode-${table}`;
      document.head.appendChild(stretchTableStyleElement);
    }
    
    // Добавляем уникальный класс к элементу таблицы
    if (dt && dt.value && dt.value.$el) {
      dt.value.$el.classList.add(`pvtables-stretch-${table}`);
    }
  };
  
  /**
   * Уничтожение style элемента для режима растягивания
   */
  const destroyStretchTableStyleElement = () => {
    if (stretchTableStyleElement) {
      document.head.removeChild(stretchTableStyleElement);
      stretchTableStyleElement = null;
    }
    
    // Убираем уникальный класс с элемента таблицы
    if (dt && dt.value && dt.value.$el) {
      dt.value.$el.classList.remove(`pvtables-stretch-${table}`);
    }
  };
  
  /**
   * Применение стилей для режима растягивания таблицы
   */
  const applyStretchTableStyles = () => {
    if (!stretchTableMode.value) {
      destroyStretchTableStyleElement();
      return;
    }
    
    createStretchTableStyleElement();
    
    // Получаем реальную ширину таблицы из DOM
    let minTableWidth = '300vw'; // Значение по умолчанию
    
    if (dt && dt.value && dt.value.$el) {
      const tableElement = dt.value.$el.querySelector('table');
      if (tableElement) {
        // Получаем реальную ширину таблицы
        const tableWidth = tableElement.scrollWidth || tableElement.offsetWidth;
        if (tableWidth > 0) {
          // Добавляем небольшой запас (5%)
          const calculatedWidth = Math.ceil(tableWidth * 1.05);
          minTableWidth = `${calculatedWidth}px`;
        }
      }
    }
    
    // Используем уникальный класс для конкретной таблицы
    const tableClass = `pvtables-stretch-${table}`;
    
    const innerHTML = `
      /* Растягиваем главный контейнер таблицы */
      .${tableClass}.pvtables {
        min-width: ${minTableWidth} !important;
        width: ${minTableWidth} !important;
      }
      
      /* Растягиваем card внутри */
      .${tableClass}.pvtables.card {
        min-width: ${minTableWidth} !important;
        width: ${minTableWidth} !important;
      }
      
      /* Растягиваем wrapper таблицы */
      .${tableClass} .p-datatable-wrapper {
        min-width: ${minTableWidth} !important;
        width: ${minTableWidth} !important;
      }
      
      /* Растягиваем саму таблицу */
      .${tableClass} .p-datatable-wrapper table {
        min-width: ${minTableWidth} !important;
        width: ${minTableWidth} !important;
      }
      
      /* Растягиваем контейнер таблицы */
      .${tableClass} [data-pc-section="tablecontainer"] {
        min-width: ${minTableWidth} !important;
        width: ${minTableWidth} !important;
      }
    `;
    
    stretchTableStyleElement.innerHTML = innerHTML;
  };
  
  // Style элемент для отключения вертикального скролла
  let verticalScrollStyleElement = null;
  
  /**
   * Создание style элемента для отключения вертикального скролла
   */
  const createVerticalScrollStyleElement = () => {
    if (!verticalScrollStyleElement) {
      verticalScrollStyleElement = document.createElement('style');
      verticalScrollStyleElement.type = 'text/css';
      verticalScrollStyleElement.id = `pvtables-vscroll-${table}`;
      document.head.appendChild(verticalScrollStyleElement);
    }
    
    // Добавляем уникальный класс к элементу таблицы
    if (dt && dt.value && dt.value.$el) {
      dt.value.$el.classList.add(`pvtables-vscroll-${table}`);
    }
  };
  
  /**
   * Уничтожение style элемента для отключения вертикального скролла
   */
  const destroyVerticalScrollStyleElement = () => {
    if (verticalScrollStyleElement) {
      document.head.removeChild(verticalScrollStyleElement);
      verticalScrollStyleElement = null;
    }
    
    // Убираем уникальный класс с элемента таблицы
    if (dt && dt.value && dt.value.$el) {
      dt.value.$el.classList.remove(`pvtables-vscroll-${table}`);
    }
  };
  
  /**
   * Применение стилей для отключения вертикального скролла
   */
  const applyVerticalScrollStyles = () => {
    if (!disableVerticalScroll.value) {
      destroyVerticalScrollStyleElement();
      return;
    }
    
    createVerticalScrollStyleElement();
    
    // Используем уникальный класс для конкретной таблицы
    const tableClass = `pvtables-vscroll-${table}`;
    
    const innerHTML = `
      /* Убираем ограничения по высоте для wrapper */
      .${tableClass} .p-datatable-wrapper {
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
      }
      
      /* Убираем вертикальный скролл */
      .${tableClass} .p-datatable-scrollable-body {
        overflow-y: visible !important;
        max-height: none !important;
      }
    `;
    
    verticalScrollStyleElement.innerHTML = innerHTML;
  };
  
  // Watchers для отслеживания изменений props
  if (props) {
    watch(() => props.scrollHeight, (newValue) => {
      // Не обновляем высоту если включен режим отключения вертикального скролла или автоподгонка
      if (!autoFitHeight.value && !disableVerticalScroll.value) {
        tableScrollHeight.value = newValue;
      }
    });
    
    watch(() => props.autoFitHeight, (newValue) => {
      autoFitHeight.value = newValue;
      if (newValue) {
        calculateTableHeight();
        window.addEventListener('resize', calculateTableHeight);
      } else {
        tableScrollHeight.value = props.scrollHeight;
        window.removeEventListener('resize', calculateTableHeight);
      }
    });
  }
  
  // Очистка при размонтировании
  onBeforeUnmount(() => {
    window.removeEventListener('resize', calculateTableHeight);
    destroyStretchTableStyleElement();
    destroyVerticalScrollStyleElement();
  });

  return {
    op,
    selectedColumns,
    darkTheme,
    serverFieldsStyle,
    toggleDarkMode,
    getClassBody,
    getClassTD,
    getColumnStyle,
    rowClass,
    baseRowStyle,
    toggleSettings,
    onToggleColomns,
    applyColumnWidths,
    saveColumnWidthsToLocal,
    saveFieldsStyleToServer,
    resetLocalFieldsStyle,
    resetServerFieldsStyle,
    loadServerFieldsStyle,
    // Управление высотой таблицы
    tableScrollHeight,
    autoFitHeight,
    calculateTableHeight,
    onAutoFitHeightToggle,
    // Управление размером шрифта
    fontSize,
    onFontSizeChange,
    // Режим растягивания таблицы
    stretchTableMode,
    onStretchTableModeToggle,
    applyStretchTableStyles,
    // Режим отключения вертикального скролла
    disableVerticalScroll,
    onDisableVerticalScrollToggle,
    applyVerticalScrollStyles
  };
}
