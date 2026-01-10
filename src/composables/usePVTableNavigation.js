/**
 * Composable для управления навигацией по ячейкам таблицы
 * @returns {Object} Методы для навигации
 */
export function usePVTableNavigation() {
  /**
   * Поиск ячейки в DOM
   * @param {HTMLElement} element - Элемент для поиска
   * @returns {HTMLElement|null} Найденная ячейка TD
   */
  const findCell = (element) => {
    if (element) {
      var cell = element;
      while (cell && cell.tagName !== 'TD') {
        cell = cell.parentElement;
      }
      return cell;
    } else {
      return null;
    }
  };

  /**
   * Поиск следующей редактируемой ячейки
   * @param {HTMLElement} cell - Текущая ячейка
   * @returns {HTMLElement|null} Следующая редактируемая ячейка
   */
  const findNextEditableColumn = (cell) => {
    if (!cell) return null;
    
    var nextCell = cell.nextElementSibling;
    if (!nextCell) {
      var nextRow = cell.parentElement.nextElementSibling;
      if (nextRow) {
        nextCell = nextRow.firstElementChild;
      }
    }
    
    if (nextCell) {
      if (
        nextCell.tagName === 'TD' &&
        !nextCell.firstElementChild.classList.contains('readonly') &&
        nextCell.firstElementChild.classList.contains('td-body') &&
        !nextCell.firstElementChild.classList.contains('view') &&
        !nextCell.firstElementChild.classList.contains('html')
      ) {
        return nextCell;
      } else {
        return findNextEditableColumn(nextCell);
      }
    } else {
      return null;
    }
  };

  /**
   * Поиск предыдущей редактируемой ячейки
   * @param {HTMLElement} cell - Текущая ячейка
   * @returns {HTMLElement|null} Предыдущая редактируемая ячейка
   */
  const findPrevEditableColumn = (cell) => {
    if (!cell) return null;
    
    var prevCell = cell.previousElementSibling;
    if (!prevCell) {
      var prevRow = cell.parentElement.previousElementSibling;
      if (prevRow) {
        prevCell = prevRow.lastElementChild;
      }
    }
    
    if (prevCell) {
      if (
        prevCell.tagName === 'TD' &&
        !prevCell.firstElementChild.classList.contains('readonly') &&
        prevCell.firstElementChild.classList.contains('td-body') &&
        !prevCell.firstElementChild.classList.contains('view') &&
        !prevCell.firstElementChild.classList.contains('html')
      ) {
        return prevCell;
      } else {
        return findPrevEditableColumn(prevCell);
      }
    } else {
      return null;
    }
  };

  /**
   * Вызов метода элемента
   * @param {HTMLElement} element - Элемент
   * @param {String} methodName - Имя метода
   * @param {Array} args - Аргументы
   * @returns {Promise} Результат вызова метода
   */
  async function invokeElementMethod(element, methodName, args) {
    return element[methodName].apply(element, args);
  }

  /**
   * Обработчик Tab из дочернего компонента
   * @param {Event} event - Событие
   */
  const onTab = (event) => {
    onKeyDown(event);
  };

  /**
   * Обработчик нажатия клавиш для навигации
   * @param {KeyboardEvent} event - Событие клавиатуры
   */
  const onKeyDown = async (event) => {
    if (event.key == 'Enter' || event.key == 'Tab') {
      if (event.key == 'Enter') {
        if (event.target.tagName == 'TEXTAREA') {
          return;
        }
      }
      
      event.preventDefault();
      event.stopPropagation();
      
      var currentCell = findCell(event.target);
      var targetCell = event.shiftKey 
        ? findPrevEditableColumn(currentCell) 
        : findNextEditableColumn(currentCell);
      
      moveCell(event, targetCell);
    }
  };

  /**
   * Перемещение фокуса на ячейку
   * @param {Event} event - Событие
   * @param {HTMLElement} targetCell - Целевая ячейка
   */
  const moveCell = async (event, targetCell) => {
    if (targetCell) {
      if (targetCell.firstElementChild.classList.contains('readonly')) {
        targetCell = findNextEditableColumn(targetCell);
      }
      
      if (targetCell.firstElementChild.classList.contains('boolean')) {
        targetCell = findNextEditableColumn(targetCell);
      }
      
      if (targetCell.firstElementChild.classList.contains('autocomplete')) {
        if (targetCell.firstElementChild.firstElementChild.tagName == 'SPAN') {
          await invokeElementMethod(targetCell, 'click');
        }
        targetCell = targetCell.firstElementChild.firstElementChild;
        targetCell.select();
      }
      if(targetCell.firstElementChild){
        if (
          targetCell.firstElementChild.classList.contains('date') ||
          targetCell.firstElementChild.classList.contains('datetime')
        ) {
          targetCell = targetCell.firstElementChild.firstElementChild.firstElementChild;
          targetCell.focus();
        }
        
        if (targetCell.firstElementChild.classList.contains('select')) {
          if (targetCell.firstElementChild.firstElementChild.tagName == 'SPAN') {
            await invokeElementMethod(targetCell, 'click');
          }
          targetCell = targetCell.firstElementChild.firstElementChild.nextElementSibling;
          invokeElementMethod(targetCell, 'click');
        } else {
          await invokeElementMethod(targetCell, 'click');
          const input = targetCell.querySelector('input, textarea');
          if (input) {
            input.focus();
            input.select();
          }
        }
      }else{
        console.log('moveCell targetCell',targetCell)
      }
    }
  };

  return {
    findCell,
    findNextEditableColumn,
    findPrevEditableColumn,
    onTab,
    onKeyDown,
    moveCell
  };
}
