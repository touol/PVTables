import { ref } from 'vue';

/**
 * Composable для drag-and-drop сортировки строк таблицы.
 * Использует HTML5 Drag API.
 *
 * @param {Object} options
 * @param {import('vue').Ref} options.lineItems - ref с массивом строк
 * @param {Function} options.onReorder - коллбэк(newOrder: id[]) после drop
 * @returns {Object}
 */
export function useTanRowDrag({ lineItems, onReorder }) {
  const draggingRowKey = ref(null);
  const dragOverRowKey = ref(null);

  function onDragStart(e, rowKey) {
    draggingRowKey.value = rowKey;
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e, rowKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverRowKey.value = rowKey;
  }

  function onDragLeave() {
    dragOverRowKey.value = null;
  }

  function onDrop(e, targetRowKey) {
    e.preventDefault();
    dragOverRowKey.value = null;

    const fromKey = draggingRowKey.value;
    draggingRowKey.value = null;
    if (!fromKey || fromKey === targetRowKey) return;

    const items = lineItems.value;
    const fromIdx = items.findIndex(r => r._rowKey === fromKey);
    const toIdx   = items.findIndex(r => r._rowKey === targetRowKey);
    if (fromIdx === -1 || toIdx === -1) return;

    // Переставляем локально для мгновенного отклика
    const newItems = [...items];
    const [moved] = newItems.splice(fromIdx, 1);
    newItems.splice(toIdx, 0, moved);
    lineItems.value = newItems;

    // Формируем новый порядок id (только реальные строки, без пустых)
    const newOrder = newItems
      .filter(r => r.id && !String(r.id).startsWith('empty'))
      .map(r => r.id);

    onReorder(newOrder);
  }

  function onDragEnd() {
    draggingRowKey.value = null;
    dragOverRowKey.value = null;
  }

  return {
    draggingRowKey,
    dragOverRowKey,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
  };
}
