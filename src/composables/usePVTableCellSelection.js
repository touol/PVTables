import { ref, onMounted, onBeforeUnmount } from 'vue';

/**
 * Composable для управления режимом выделения ячеек
 * @param {Object} columns - Колонки таблицы
 * @param {Object} lineItems - Элементы таблицы
 * @param {Object} hideId - Флаг скрытия ID
 * @returns {Object} Методы и состояние для работы с выделением ячеек
 */
export function usePVTableCellSelection(columns, lineItems, hideId) {
  const cellSelectionMode = ref(false);
  const selectedCells = ref([]);
  const selectionStart = ref(null);
  const isSelecting = ref(false);

  /**
   * Переключение режима выделения ячеек
   */
  const toggleCellSelectionMode = () => {
    cellSelectionMode.value = !cellSelectionMode.value;

    if (!cellSelectionMode.value) {
      selectedCells.value = [];
      selectionStart.value = null;
      isSelecting.value = false;
    }
  };

  /**
   * Получение данных ячейки по индексам
   * @param {Number} rowIndex - Индекс строки
   * @param {Number} colIndex - Индекс колонки
   * @returns {Object|null} Данные ячейки
   */
  const getCellData = (rowIndex, colIndex) => {
    const table = document.querySelector('[data-cell-selection-mode="true"]');
    if (!table) return null;

    const targetRow = table.querySelector(`tbody tr[data-p-index="${rowIndex}"]`);
    if (!targetRow) return null;

    const cells = targetRow.querySelectorAll('td');
    const targetCell = cells[colIndex];
    if (!targetCell) return null;

    const row = lineItems.value[rowIndex];
    if (!row) return null;

    const visibleColumns = columns.value.filter(c =>
      !c.modal_only &&
      c.type !== 'hidden' &&
      !(hideId.value && c.field === 'id')
    );

    let fieldName = null;
    const bodyDiv = targetCell.querySelector('.td-body');
    
    if (bodyDiv) {
      let tdBodyIndex = 0;
      for (let i = 0; i < colIndex; i++) {
        const cellBodyDiv = cells[i].querySelector('.td-body');
        if (cellBodyDiv) {
          const cellStyle = window.getComputedStyle(cells[i]);
          const isVisible = cellStyle.display !== 'none' && cellStyle.visibility !== 'hidden';

          if (isVisible) {
            tdBodyIndex++;
          }
        }
      }

      const col = visibleColumns[tdBodyIndex];
      if (col) {
        fieldName = col.field;
      }
    }

    if (!fieldName) return null;

    const col = visibleColumns.find(c => c.field === fieldName);
    if (!col) return null;

    const adjustedColIndex = visibleColumns.findIndex(c => c.field === fieldName);

    let displayValue = bodyDiv ? bodyDiv.textContent.trim() : row[col.field];

    const isSummable = col.type === 'decimal' || col.type === 'number';

    if (isSummable) {
      const numStr = displayValue.replace(/\s/g, '').replace(',', '.');
      const num = parseFloat(numStr);
      if (!isNaN(num)) {
        displayValue = num;
      }
    }

    const cellData = {
      rowIndex,
      colIndex: adjustedColIndex,
      field: col.field,
      value: displayValue,
      label: col.label,
      summable: isSummable
    };

    return cellData;
  };

  /**
   * Обработчик нажатия мыши на ячейку
   * @param {Number} rowIndex - Индекс строки
   * @param {Number} colIndex - Индекс колонки
   * @param {Event} event - Событие мыши
   */
  const onCellMouseDown = (rowIndex, colIndex, event) => {
    if (!cellSelectionMode.value) return;

    isSelecting.value = true;
    selectionStart.value = { rowIndex, colIndex };

    const cellData = getCellData(rowIndex, colIndex);
    if (cellData) {
      if (event.ctrlKey || event.metaKey) {
        selectedCells.value = [...selectedCells.value, cellData];
      } else {
        selectedCells.value = [cellData];
      }
    }
  };

  /**
   * Обработчик наведения мыши на ячейку
   * @param {Number} rowIndex - Индекс строки
   * @param {Number} colIndex - Индекс колонки
   * @param {Event} event - Событие мыши
   */
  const onCellMouseEnter = (rowIndex, colIndex, event) => {
    if (!isSelecting.value || !cellSelectionMode.value || !selectionStart.value) return;

    const currentCellData = getCellData(rowIndex, colIndex);
    if (!currentCellData) return;

    const minRow = Math.min(selectionStart.value.rowIndex, rowIndex);
    const maxRow = Math.max(selectionStart.value.rowIndex, rowIndex);

    const startCellData = getCellData(selectionStart.value.rowIndex, selectionStart.value.colIndex);
    if (!startCellData) return;

    const minCol = Math.min(startCellData.colIndex, currentCellData.colIndex);
    const maxCol = Math.max(startCellData.colIndex, currentCellData.colIndex);

    const currentRangeSelection = [];

    for (let r = minRow; r <= maxRow; r++) {
      for (let adjustedCol = minCol; adjustedCol <= maxCol; adjustedCol++) {
        let fullColIndex = adjustedCol;
        // Учитываем колонку дерева если есть
        const hasTreeColumn = columns.value.some(c => c.field === 'tree');
        if (hasTreeColumn) fullColIndex += 1;
        fullColIndex += 1; // checkbox column

        const cellData = getCellData(r, fullColIndex);
        if (cellData) {
          currentRangeSelection.push(cellData);
        }
      }
    }

    if (event?.ctrlKey || event?.metaKey) {
      const previousSelection = selectedCells.value.filter(cell => {
        const isInCurrentRange = cell.rowIndex >= minRow && cell.rowIndex <= maxRow &&
                                 cell.colIndex >= minCol && cell.colIndex <= maxCol;
        return !isInCurrentRange;
      });

      selectedCells.value = [...previousSelection, ...currentRangeSelection];
    } else {
      selectedCells.value = currentRangeSelection;
    }
  };

  /**
   * Обработчик отпускания мыши
   */
  const onCellMouseUp = () => {
    isSelecting.value = false;
  };

  /**
   * Обработчик копирования ячеек
   * @param {String} tsvData - Данные в формате TSV
   */
  const handleCellCopy = (tsvData) => {
    console.log('Данные скопированы:', tsvData);
  };

  /**
   * Обработчик горячих клавиш
   * @param {KeyboardEvent} e - Событие клавиатуры
   */
  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
      e.preventDefault();
      toggleCellSelectionMode();
    }
  };

  // Монтирование и размонтирование обработчиков
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mouseup', onCellMouseUp);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mouseup', onCellMouseUp);
  });

  return {
    cellSelectionMode,
    selectedCells,
    selectionStart,
    isSelecting,
    toggleCellSelectionMode,
    getCellData,
    onCellMouseDown,
    onCellMouseEnter,
    onCellMouseUp,
    handleCellCopy
  };
}
