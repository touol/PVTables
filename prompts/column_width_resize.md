# Управление шириной колонок в PVTables

## Задача
Найти и проанализировать код, который управляет изменением ширины колонок в компоненте PVTables.

## Текущая реализация

### 1. DataTable - основной компонент таблицы

**Файл:** `src/PVTables.vue`

```vue
<DataTable
  :value="lineItems"
  resizableColumns 
  columnResizeMode="expand"
  ...
>
```

**Параметры:**
- `resizableColumns` - включает возможность изменения ширины колонок
- `columnResizeMode="expand"` - режим изменения размера:
  - `"expand"` - при изменении ширины одной колонки, общая ширина таблицы увеличивается/уменьшается
  - `"fit"` - при изменении ширины одной колонки, соседние колонки автоматически подстраиваются

### 2. Стили колонок

**Файл:** `src/composables/usePVTableStyles.js`

```javascript
/**
 * Получение стилей для колонки
 * @param {Object} col - Объект колонки
 * @returns {Object} Объект стилей
 */
const getColumnStyle = (col) => {
  let style = {};
  
  // Установка ширины колонки
  if (col.width) {
    style.width = col.width;
  }
  
  // Установка минимальной ширины
  if (col.minWidth) {
    style.minWidth = col.minWidth;
  }
  
  // Установка максимальной ширины
  if (col.maxWidth) {
    style.maxWidth = col.maxWidth;
  }
  
  return style;
};
```

**Применение в шаблоне:**

```vue
<Column
  v-for="col of columns.filter(...)"
  :field="col.field"
  :header="col.label"
  :style="getColumnStyle(col)"
  ...
>
```

### 3. Настройка ширины колонок через API

Ширина колонок может быть задана на сервере в ответе `api.options()`:

```javascript
// Пример ответа сервера
{
  "fields": {
    "id": {
      "label": "ID",
      "type": "view",
      "width": "80px",      // Фиксированная ширина
      "minWidth": "60px",   // Минимальная ширина
      "maxWidth": "120px"   // Максимальная ширина
    },
    "name": {
      "label": "Название",
      "type": "text",
      "width": "200px"
    }
  }
}
```

### 4. Механизм работы

1. **Инициализация:**
   - Сервер возвращает конфигурацию полей с параметрами `width`, `minWidth`, `maxWidth`
   - Эти параметры сохраняются в объекте `fields`

2. **Применение стилей:**
   - При рендеринге колонок вызывается `getColumnStyle(col)`
   - Функция формирует объект стилей на основе параметров колонки
   - Стили применяются через атрибут `:style`

3. **Изменение размера пользователем:**
   - PrimeVue DataTable обрабатывает изменение размера колонок встроенными средствами
   - При `resizableColumns={true}` появляются разделители между колонками
   - Пользователь может перетаскивать разделители для изменения ширины
   - Режим `columnResizeMode="expand"` определяет поведение при изменении

## Связанные файлы

1. **src/PVTables.vue** - основной компонент с DataTable
2. **src/composables/usePVTableStyles.js** - функция `getColumnStyle()`
3. **src/components/DataTable/DataTable.vue** - кастомный компонент DataTable (обертка над PrimeVue)

## Возможные улучшения

### 1. Сохранение пользовательских настроек ширины

Можно добавить сохранение ширины колонок в localStorage:

```javascript
// Сохранение при изменении размера
const onColumnResize = (event) => {
  const columnWidths = {};
  event.columns.forEach(col => {
    columnWidths[col.field] = col.width;
  });
  localStorage.setItem(`pvtables-${props.table}-widths`, JSON.stringify(columnWidths));
};

// Восстановление при загрузке
const restoreColumnWidths = () => {
  const saved = localStorage.getItem(`pvtables-${props.table}-widths`);
  if (saved) {
    const widths = JSON.parse(saved);
    columns.value.forEach(col => {
      if (widths[col.field]) {
        col.width = widths[col.field];
      }
    });
  }
};
```

### 2. Автоматическая подстройка ширины

Можно добавить автоматическую подстройку ширины колонок по содержимому:

```javascript
const autoSizeColumn = (field) => {
  // Найти максимальную ширину контента в колонке
  const maxWidth = Math.max(
    ...lineItems.value.map(item => {
      const text = String(item[field] || '');
      return text.length * 8; // Примерная ширина символа
    })
  );
  
  // Установить ширину с учетом минимума и максимума
  const col = columns.value.find(c => c.field === field);
  if (col) {
    col.width = `${Math.min(Math.max(maxWidth, 100), 500)}px`;
  }
};
```

### 3. Режимы изменения размера

Добавить переключение между режимами:

```javascript
const columnResizeMode = ref('expand'); // или 'fit'

const toggleResizeMode = () => {
  columnResizeMode.value = columnResizeMode.value === 'expand' ? 'fit' : 'expand';
};
```

## События DataTable для работы с шириной

PrimeVue DataTable предоставляет события:

- `@column-resize-end` - срабатывает после изменения ширины колонки
- `@column-reorder` - срабатывает при изменении порядка колонок

Пример использования:

```vue
<DataTable
  @column-resize-end="onColumnResizeEnd"
  ...
>
```

```javascript
const onColumnResizeEnd = (event) => {
  console.log('Column resized:', event);
  // event.element - DOM элемент колонки
  // event.delta - изменение ширины
};
```

## Заключение

Управление шириной колонок в PVTables реализовано через:
1. Встроенные возможности PrimeVue DataTable (`resizableColumns`, `columnResizeMode`)
2. Функцию `getColumnStyle()` для применения серверных настроек ширины
3. Параметры `width`, `minWidth`, `maxWidth` в конфигурации полей

Система гибкая и позволяет:
- Задавать ширину на сервере
- Изменять ширину пользователем через UI
- Расширять функциональность (сохранение настроек, автоподстройка и т.д.)
