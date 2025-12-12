import { ref, computed, watch } from 'vue';

/**
 * Composable для управления виртуальным скроллингом в таблицах
 * @param {Object} params - Параметры
 * @param {Ref} params.columns - Реактивная ссылка на колонки таблицы
 * @param {Ref} params.lineItems - Реактивная ссылка на данные строк
 * @param {Ref} params.dt - Реактивная ссылка на компонент DataTable
 * @param {String} params.storageKey - Ключ для localStorage
 */
export function useVirtualScroll({ columns, lineItems, dt, storageKey }) {
  // Состояние виртуального скроллинга
  const virtualScrollEnabled = ref(false); // По умолчанию выключен
  const rowHeight = ref(50);
  const calculatedRowHeight = ref(50);
  const virtualScrollPopover = ref(null);

  // Загрузка настроек из localStorage
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const settings = JSON.parse(saved);
        virtualScrollEnabled.value = settings.enabled !== undefined ? settings.enabled : true;
        rowHeight.value = settings.rowHeight || 50;
      }
    } catch (e) {
      console.error('Ошибка загрузки настроек виртуального скроллинга:', e);
    }
  };

  // Сохранение настроек в localStorage
  const saveSettings = () => {
    try {
      const settings = {
        enabled: virtualScrollEnabled.value,
        rowHeight: rowHeight.value
      };
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (e) {
      console.error('Ошибка сохранения настроек виртуального скроллинга:', e);
    }
  };

  // Функция автоопределения высоты строки
  const calculateOptimalRowHeight = () => {
    if (!lineItems.value || lineItems.value.length === 0 || !columns.value) {
      return 50;
    }
    
    let maxHeight = 50;
    const sampleSize = Math.min(100, lineItems.value.length);
    
    columns.value.forEach(col => {
      if (col.modal_only || col.type === 'hidden') return;
      
      // Анализируем ТОЛЬКО text и textarea
      if (!['text', 'textarea'].includes(col.type)) {
        return;
      }
      
      // Определяем ширину колонки
      let columnWidth = 200; // Дефолт
      
      if (col.width) {
        columnWidth = parseInt(col.width) || 200;
      } else if (col['min-width']) {
        columnWidth = parseInt(col['min-width']) || 200;
      } else if (col.style?.width) {
        columnWidth = parseInt(col.style.width) || 200;
      } else if (col.type === 'textarea' || col.type === 'text') {
        // Из CSS: td.textarea, td.text { max-width: 100px; }
        columnWidth = 100;
      }
      
      // Попытка получить реальную ширину из DOM
      if (dt.value && dt.value.$el) {
        const tableEl = dt.value.$el;
        const headerCells = tableEl.querySelectorAll('thead th');
        
        const colIndex = columns.value
          .filter(c => !c.modal_only && c.type !== 'hidden')
          .findIndex(c => c.field === col.field);
        
        // +2 для tree column и checkbox column
        if (colIndex >= 0 && headerCells[colIndex + 2]) {
          const actualWidth = headerCells[colIndex + 2].offsetWidth;
          if (actualWidth > 0) {
            columnWidth = actualWidth;
          }
        }
      }
      
      // Вычисляем символов на строку (учитываем padding)
      const padding = 16;
      const avgCharsPerLine = Math.floor((columnWidth - padding) / 8);
      
      // Анализируем данные
      for (let i = 0; i < sampleSize; i++) {
        const row = lineItems.value[i];
        const value = row[col.field];
        
        if (!value) continue;
        
        const textLength = String(value).length;
        let estimatedLines = Math.ceil(textLength / avgCharsPerLine);
        
        // Ограничиваем 2-3 строками
        estimatedLines = Math.min(estimatedLines, 3);
        
        const lineHeight = 20;
        const cellPadding = 20;
        const cellHeight = cellPadding + (lineHeight * estimatedLines);
        
        maxHeight = Math.max(maxHeight, cellHeight);
      }
    });
    
    return Math.ceil(maxHeight) + 10;
  };

  // Пересчет высоты строки
  const recalculateRowHeight = () => {
    const calculated = calculateOptimalRowHeight();
    calculatedRowHeight.value = calculated;
    rowHeight.value = calculated;
    saveSettings();
  };

  // Переключение виртуального скроллинга
  const onVirtualScrollToggle = () => {
    if (virtualScrollEnabled.value) {
      // При включении - пересчитываем высоту
      recalculateRowHeight();
    }
    saveSettings();
  };

  // Открытие/закрытие настроек
  const toggleVirtualScrollSettings = (event) => {
    if (virtualScrollPopover.value) {
      virtualScrollPopover.value.toggle(event);
    }
  };

  // virtualScrollerOptions для DataTable
  const virtualScrollerOptions = computed(() => {
    if (!virtualScrollEnabled.value) {
      return null;
    }
    
    return {
      itemSize: rowHeight.value,
      delay: 0,
      lazy: true
    };
  });

  // Computed для стиля строк с фиксированной высотой
  const getVirtualScrollRowStyle = (existingRowStyle) => {
    return (data) => {
      const baseStyle = typeof existingRowStyle === 'function' 
        ? existingRowStyle(data) 
        : (existingRowStyle || {});
      
      if (virtualScrollEnabled.value) {
        return {
          ...baseStyle,
          height: `${rowHeight.value}px`,
          maxHeight: `${rowHeight.value}px`,
          minHeight: `${rowHeight.value}px`
        };
      }
      
      return baseStyle;
    };
  };

  // Отслеживание изменений высоты строки
  watch(rowHeight, () => {
    if (virtualScrollEnabled.value) {
      saveSettings();
    }
  });

  // Инициализация при монтировании
  loadSettings();

  // Автоматический пересчет при загрузке данных
  watch([lineItems, columns], () => {
    if (virtualScrollEnabled.value && lineItems.value && lineItems.value.length > 0) {
      const calculated = calculateOptimalRowHeight();
      calculatedRowHeight.value = calculated;
    }
  }, { deep: false });

  return {
    // Состояние
    virtualScrollEnabled,
    rowHeight,
    calculatedRowHeight,
    virtualScrollPopover,
    
    // Computed
    virtualScrollerOptions,
    
    // Методы
    onVirtualScrollToggle,
    toggleVirtualScrollSettings,
    recalculateRowHeight,
    getVirtualScrollRowStyle,
    loadSettings,
    saveSettings
  };
}
