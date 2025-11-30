# Задача 2: Режим выделения диапазона ячеек

## Описание задачи

Реализовать режим выделения диапазона ячеек в таблице с подсчетом статистики и копированием в Excel:

1. **Кнопка включения режима** в toolbar
2. **Горячие клавиши** `Ctrl+Shift+S` для включения/выключения режима
3. **Выделение диапазона** ячеек мышью (drag selection)
4. **Строка состояния** с отображением:
   - Количество выделенных ячеек
   - Сумма числовых значений
   - Среднее числовых значений
5. **Кнопка копирования** для вставки в Excel (TSV формат)
6. **Визуальное оформление**: синеватый border 2px для выделенных ячеек

## Структура реализации

### Этап 1: Создание компонента StatusBar.vue

**Файл:** `src/components/DataTable/StatusBar.vue`

```vue
<template>
  <div class="datatable-status-bar">
    <div class="status-info">
      <span class="status-item">
        <i class="pi pi-check-square"></i>
        Выделено: <strong>{{ cellCount }}</strong> {{ cellWord }}
      </span>
      <span v-if="sum !== null" class="status-item">
        <i class="pi pi-calculator"></i>
        Сумма: <strong>{{ formatNumber(sum) }}</strong>
      </span>
      <span v-if="average !== null" class="status-item">
        <i class="pi pi-chart-line"></i>
        Среднее: <strong>{{ formatNumber(average) }}</strong>
      </span>
    </div>
    <Button 
      icon="pi pi-copy" 
      label="Копировать"
      size="small"
      severity="secondary"
      @click="copyToClipboard"
      :disabled="cellCount === 0"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Button from 'primevue/button';
import { useNotifications } from '../useNotifications';

const props = defineProps({
  selectedCells: {
    type: Array,
    required: true,
    default: () => []
  }
});

const emit = defineEmits(['copy']);

const { notify } = useNotifications();

// Количество выделенных ячеек
const cellCount = computed(() => props.selectedCells.length);

// Склонение слова "ячейка"
const cellWord = computed(() => {
  const count = cellCount.value;
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'ячеек';
  if (lastDigit === 1) return 'ячейка';
  if (lastDigit >= 2 && lastDigit <= 4) return 'ячейки';
  return 'ячеек';
});

// Сумма числовых значений
const sum = computed(() => {
  const numbers = props.selectedCells
    .map(cell => {
      const value = cell.value;
      // Обработка различных форматов чисел
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        // Удаляем пробелы и заменяем запятую на точку
        const cleaned = value.replace(/\s/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    })
    .filter(n => n !== null);
  
  return numbers.length > 0 
    ? numbers.reduce((acc, n) => acc + n, 0) 
    : null;
});

// Среднее значение
const average = computed(() => {
  if (sum.value === null) return null;
  
  const numbers = props.selectedCells
    .map(cell => {
      const value = cell.value;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const cleaned = value.replace(/\s/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    })
    .filter(n => n !== null);
  
  return numbers.length > 0 ? sum.value / numbers.length : null;
});

// Форматирование чисел
const formatNumber = (num) => {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
};

// Копирование в буфер обмена (TSV формат для Excel)
const copyToClipboard = async () => {
  if (props.selectedCells.length === 0) return;
  
  try {
    // Группировка ячеек по строкам
    const rowsMap = new Map();
    
    props.selectedCells.forEach(cell => {
      if (!rowsMap.has(cell.rowIndex)) {
        rowsMap.set(cell.rowIndex, []);
      }
      rowsMap.get(cell.rowIndex).push(cell);
    });
    
    // Сортировка строк и столбцов, форматирование в TSV
    const rows = Array.from(rowsMap.entries())
      .sort((a, b) => a[0] - b[0]) // Сортировка по индексу строки
      .map(([_, cells]) => {
        return cells
          .sort((a, b) => a.colIndex - b.colIndex) // Сортировка по индексу столбца
          .map(cell => {
            const value = cell.value ?? '';
            // Экранирование табуляций и переносов строк
            return String(value).replace(/\t/g, ' ').replace(/\n/g, ' ');
          })
          .join('\t'); // TSV = Tab-Separated Values
      });
    
    const tsvData = rows.join('\n');
    
    // Копирование в буфер обмена
    await navigator.clipboard.writeText(tsvData);
    
    notify('success', { 
      detail: `Скопировано ${cellCount.value} ${cellWord.value} в буфер обмена` 
    });
    
    emit('copy', tsvData);
  } catch (err) {
    console.error('Ошибка копирования:', err);
    notify('error', { 
      detail: 'Ошибка копирования: ' + err.message 
    });
  }
};
</script>

<style scoped>
.datatable-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  font-size: 14px;
  gap: 12px;
}

.status-info {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #495057;
}

.status-item i {
  color: #6c757d;
  font-size: 14px;
}

.status-item strong {
  color: #212529;
  font-weight: 600;
}

@media (max-width: 768px) {
  .datatable-status-bar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .status-info {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
```

### Этап 2: Добавление состояния в PVTables.vue

**Местоположение:** После существующих ref переменных (после строки ~100)

```javascript
// Режим выделения ячеек
const cellSelectionMode = ref(false);
const selectedCells = ref([]);
const selectionStart = ref(null);
const isSelecting = ref(false);
```

**Добавить методы:**

```javascript
// Переключение режима выделения
const toggleCellSelectionMode = () => {
  cellSelectionMode.value = !cellSelectionMode.value;
  
  // Очистка выделения при выключении режима
  if (!cellSelectionMode.value) {
    selectedCells.value = [];
    selectionStart.value = null;
    isSelecting.value = false;
  }
};

// Получение данных ячейки
const getCellData = (rowIndex, colIndex) => {
  const row = lineItems.value[rowIndex];
  const col = columns.value.filter(c => !c.modal_only && c.type !== 'hidden')[colIndex];
  
  if (!row || !col) return null;
  
  return {
    rowIndex,
    colIndex,
    field: col.field,
    value: row[col.field],
    label: col.label
  };
};

// Обработчики событий мыши для выделения
const onCellMouseDown = (rowIndex, colIndex, event) => {
  if (!cellSelectionMode.value) return;
  
  isSelecting.value = true;
  selectionStart.value = { rowIndex, colIndex };
  
  const cellData = getCellData(rowIndex, colIndex);
  if (cellData) {
    // Если Ctrl нажат - добавляем к существующему выделению
    if (event.ctrlKey || event.metaKey) {
      selectedCells.value = [...selectedCells.value, cellData];
    } else {
      // Если Ctrl не нажат - сбрасываем старое выделение и создаем новое
      selectedCells.value = [cellData];
    }
  }
};

const onCellMouseEnter = (rowIndex, colIndex, event) => {
  if (!isSelecting.value || !cellSelectionMode.value || !selectionStart.value) return;
  
  // Вычисление прямоугольника выделения
  const minRow = Math.min(selectionStart.value.rowIndex, rowIndex);
  const maxRow = Math.max(selectionStart.value.rowIndex, rowIndex);
  const minCol = Math.min(selectionStart.value.colIndex, colIndex);
  const maxCol = Math.max(selectionStart.value.colIndex, colIndex);
  
  // Заполнение массива выделенных ячеек для текущего диапазона
  const currentRangeSelection = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const cellData = getCellData(r, c);
      if (cellData) {
        currentRangeSelection.push(cellData);
      }
    }
  }
  
  // Если Ctrl нажат - объединяем с предыдущим выделением
  if (event?.ctrlKey || event?.metaKey) {
    // Получаем ячейки, которые были выделены до начала текущего drag
    const previousSelection = selectedCells.value.filter(cell => {
      const isInCurrentRange = cell.rowIndex >= minRow && cell.rowIndex <= maxRow &&
                               cell.colIndex >= minCol && cell.colIndex <= maxCol;
      return !isInCurrentRange;
    });
    
    selectedCells.value = [...previousSelection, ...currentRangeSelection];
  } else {
    // Если Ctrl не нажат - только текущий диапазон
    selectedCells.value = currentRangeSelection;
  }
};

const onCellMouseUp = () => {
  isSelecting.value = false;
};

// Глобальный обработчик mouseup (на случай если мышь вышла за пределы таблицы)
onMounted(() => {
  document.addEventListener('mouseup', onCellMouseUp);
});

onBeforeUnmount(() => {
  document.removeEventListener('mouseup', onCellMouseUp);
});
```

**Добавить горячие клавиши в onMounted:**

```javascript
onMounted(async () => {
  // ... существующий код ...
  
  // Горячие клавиши для режима выделения
  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
      e.preventDefault();
      toggleCellSelectionMode();
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  
  // Очистка при размонтировании
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
});
```

**Добавить кнопку в Toolbar (после строки ~72):**

```vue
<Button
  :icon="cellSelectionMode ? 'pi pi-check-square' : 'pi pi-table'"
  :label="cellSelectionMode ? 'Выделение ВКЛ' : 'Выделение ВЫКЛ'"
  :class="cellSelectionMode ? 'p-button-success' : ''"
  @click="toggleCellSelectionMode"
  v-tooltip.bottom="'Режим выделения ячеек (Ctrl+Shift+S)'"
/>
```

**Добавить StatusBar после Toolbar (после строки ~100):**

```vue
<StatusBar 
  v-if="cellSelectionMode && selectedCells.length > 0"
  :selectedCells="selectedCells"
  @copy="handleCellCopy"
/>
```

**Добавить импорт:**

```javascript
import StatusBar from './components/DataTable/StatusBar.vue';
```

**Добавить в components:**

```javascript
components: {
  // ... существующие компоненты ...
  StatusBar
}
```

### Этап 3: Модификация DataTable.vue

**Добавить props для передачи состояния выделения:**

В `src/components/DataTable/BaseDataTable.vue` добавить:

```javascript
cellSelectionMode: {
  type: Boolean,
  default: false
},
cellSelectionState: {
  type: Object,
  default: null
}
```

**В PVTables.vue передать props в DataTable:**

```vue
<DataTable
  :cellSelectionMode="cellSelectionMode"
  :cellSelectionState="{ 
    isSelecting, 
    selectedCells, 
    onCellMouseDown, 
    onCellMouseEnter 
  }"
  ...
>
```

### Этап 4: Модификация BodyCell.vue

**Добавить props:**

```javascript
cellSelectionMode: {
  type: Boolean,
  default: false
},
cellSelectionState: {
  type: Object,
  default: null
}
```

**Добавить computed для проверки выделения:**

```javascript
computed: {
  // ... существующие computed ...
  
  isCellSelected() {
    if (!this.cellSelectionState?.selectedCells) return false;
    
    return this.cellSelectionState.selectedCells.some(
      cell => cell.rowIndex === this.rowIndex && cell.colIndex === this.index
    );
  }
}
```

**Модифицировать template (добавить обработчики и класс):**

```vue
<td
  v-else
  :style="containerStyle"
  :class="[containerClass, { 'cell-selected': isCellSelected }]"
  :colspan="columnProp('colspan')"
  :rowspan="columnProp('rowspan')"
  @click="onClick"
  @keydown="onKeyDown"
  @mousedown="onCellMouseDown"
  @mouseenter="onCellMouseEnter"
  role="cell"
  v-bind="{ ...getColumnPT('root'), ...getColumnPT('bodyCell') }"
  :data-p-selection-column="columnProp('selectionMode') != null"
  :data-p-editable-column="isEditable()"
  :data-p-cell-editing="d_editing"
  :data-p-frozen-column="columnProp('frozen')"
>
```

**Добавить методы обработчиков:**

```javascript
methods: {
  // ... существующие методы ...
  
  onCellMouseDown(event) {
    if (this.cellSelectionMode && this.cellSelectionState?.onCellMouseDown) {
      event.preventDefault();
      this.cellSelectionState.onCellMouseDown(this.rowIndex, this.index, event);
    }
  },
  
  onCellMouseEnter(event) {
    if (this.cellSelectionMode && this.cellSelectionState?.onCellMouseEnter) {
      this.cellSelectionState.onCellMouseEnter(this.rowIndex, this.index, event);
    }
  }
}
```

### Этап 5: Стили

**В src/style.css добавить:**

```css
/* Выделенная ячейка */
.cell-selected {
  border: 2px solid #4A90E2 !important;
  background-color: rgba(74, 144, 226, 0.1) !important;
  position: relative;
  z-index: 1;
}

/* Курсор в режиме выделения */
.p-datatable[data-cell-selection-mode="true"] td:not([data-p-selection-column="true"]) {
  cursor: cell;
  user-select: none;
}

/* Отключение выделения текста при drag */
.p-datatable[data-cell-selection-mode="true"] {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}
```

**В PVTables.vue добавить атрибут на DataTable:**

```vue
<DataTable
  :data-cell-selection-mode="cellSelectionMode"
  ...
>
```

## Тестирование

### Тест 1: Включение/выключение режима
1. Нажать кнопку "Выделение ВЫКЛ" → проверить изменение на "Выделение ВКЛ"
2. Нажать Ctrl+Shift+S → проверить переключение режима
3. Проверить изменение курсора на ячейках

### Тест 2: Выделение одной ячейки
1. Включить режим выделения
2. Кликнуть на ячейку → проверить синий border
3. Проверить отображение в StatusBar: "Выделено: 1 ячейка"

### Тест 3: Выделение диапазона
1. Зажать мышь на ячейке A1
2. Потянуть до ячейки C3
3. Проверить выделение прямоугольника 3x3 = 9 ячеек
4. Проверить StatusBar: "Выделено: 9 ячеек"

### Тест 3.1: Множественное выделение с Ctrl
1. Выделить диапазон A1:C3 (9 ячеек)
2. Зажать Ctrl и выделить диапазон E1:F2 (4 ячейки)
3. Проверить: оба диапазона выделены, StatusBar: "Выделено: 13 ячеек"
4. Выделить новый диапазон БЕЗ Ctrl → проверить сброс предыдущих выделений

### Тест 4: Подсчет статистики
1. Выделить ячейки с числами: 10, 20, 30
2. Проверить: Сумма = 60, Среднее = 20
3. Выделить ячейки с текстом → проверить отсутствие суммы/среднего

### Тест 5: Копирование в Excel
1. Выделить диапазон ячеек
2. Нажать "Копировать"
3. Вставить в Excel → проверить сохранение структуры

### Тест 6: Смешанные данные
1. Выделить ячейки: "текст", 100, "", 200
2. Проверить: Сумма = 300, Среднее = 150 (только числа)

## Возможные проблемы и решения

### Проблема 1: Выделение не работает в режиме редактирования
**Решение:** Отключать cellSelectionMode при входе в режим редактирования ячейки

### Проблема 2: Конфликт с выделением строк
**Решение:** В режиме cellSelectionMode отключать row selection

### Проблема 3: Выделение выходит за границы таблицы
**Решение:** Добавить проверку границ в getCellData()

### Проблема 4: Медленная работа на больших таблицах
**Решение:** Оптимизировать selectedCells через Set вместо Array

## Логика множественного выделения с Ctrl

### Поведение при выделении:

1. **Без Ctrl:**
   - Начало нового выделения → сброс всех предыдущих выделений
   - Drag → выделяется только текущий прямоугольник
   - Результат: только один диапазон выделен

2. **С Ctrl (зажат):**
   - Начало нового выделения → сохранение предыдущих выделений
   - Drag → добавление нового прямоугольника к существующим
   - Результат: несколько диапазонов выделены одновременно

### Пример использования:

```
Шаг 1: Выделить A1:C3 (без Ctrl)
  → Выделено: 9 ячеек

Шаг 2: Ctrl + выделить E1:F2
  → Выделено: 9 + 4 = 13 ячеек (два диапазона)

Шаг 3: Ctrl + выделить H1:H3
  → Выделено: 9 + 4 + 3 = 16 ячеек (три диапазона)

Шаг 4: Выделить J1:J2 (без Ctrl)
  → Выделено: 2 ячейки (все предыдущие сброшены)
```

## Дополнительные улучшения (опционально)

1. **Копирование с заголовками:**
   - Добавить опцию включения заголовков столбцов

2. **Форматирование чисел:**
   - Сохранять форматирование при копировании

3. **Клавиатурное выделение:**
   - Shift+стрелки для выделения

4. **Контекстное меню:**
   - ПКМ на выделении → Копировать, Экспорт в CSV

5. **Визуальные улучшения:**
   - Анимация появления StatusBar
   - Подсветка границ выделенного диапазона
   - Разные оттенки для разных диапазонов при Ctrl-выделении
