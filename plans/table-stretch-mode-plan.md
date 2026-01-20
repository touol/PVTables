# План реализации переключателя растягивания таблицы

## Описание задачи

Добавить переключатель в Popover настроек (строка 3 в [`PVTables.vue`](../src/PVTables.vue:3)), который позволит растягивать таблицу за пределы экрана для отображения всех столбцов. Это решит проблему на Android-устройствах, где невозможно уменьшить масштаб двумя пальцами, если контент уже помещается по ширине экрана.

**Важно:** При включении режима растягивания вертикальный скролл таблицы отключается (tableScrollHeight устанавливается в null), чтобы таблица отображалась полностью по высоте и ширине.

## Анализ текущей реализации

### Существующие механизмы

1. **Popover настроек** ([`PVTables.vue:3-34`](../src/PVTables.vue:3-34))
   - Уже содержит настройки колонок, высоты таблицы, размера шрифта
   - Использует [`ToggleSwitch`](../src/PVTables.vue:9) для переключателей
   - Сохраняет настройки через [`usePVTableStyles`](../src/composables/usePVTableStyles.js)

2. **Система сохранения настроек** ([`usePVTableStyles.js`](../src/composables/usePVTableStyles.js))
   - Использует `localStorage` для локального хранения
   - Поддерживает сохранение на сервере через API
   - Примеры: размер шрифта (строка 30), ширина колонок (строка 362)

3. **Управление шириной таблицы** ([`usePVTableStyles.js:288-321`](../src/composables/usePVTableStyles.js:288-321))
   - Функция [`addColumnWidthStyles`](../src/composables/usePVTableStyles.js:288) создает динамический `<style>` элемент
   - Применяет CSS правила для ширины таблицы и колонок
   - Использует селекторы `data-pc-name="datatable"`

## Техническое решение

### 1. Добавление переключателя в UI

**Местоположение:** [`PVTables.vue:3-34`](../src/PVTables.vue:3-34) - внутри Popover настроек

**Компонент:**
```vue
<div class="field-checkbox" style="margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem;">
  <ToggleSwitch v-model="stretchTableMode" @change="onStretchTableModeToggle" inputId="stretch-table-toggle" />
  <label for="stretch-table-toggle" style="margin: 0;">Растянуть таблицу для масштабирования на мобильных</label>
</div>
```

**Позиция:** После переключателя автоподгонки высоты (строка 8-11), перед полем высоты таблицы

### 2. Добавление логики в composable

**Файл:** [`src/composables/usePVTableStyles.js`](../src/composables/usePVTableStyles.js)

#### 2.1 Добавить reactive переменную

```javascript
// После строки 27
const stretchTableMode = ref(false);
let savedScrollHeight = null; // Для сохранения значения высоты при переключении режима

// Загрузка сохраненного значения из localStorage
const savedStretchMode = localStorage.getItem(`pvtables-${table}-stretch-mode`);
if (savedStretchMode !== null) {
  stretchTableMode.value = savedStretchMode === 'true';
  // Если режим был включен, сразу устанавливаем null для высоты
  if (stretchTableMode.value) {
    savedScrollHeight = tableScrollHeight.value;
    tableScrollHeight.value = null;
  }
}
```

#### 2.2 Создать функцию переключения режима

```javascript
/**
 * Обработчик переключения режима растягивания таблицы
 */
const onStretchTableModeToggle = () => {
  // Сохраняем в localStorage
  localStorage.setItem(`pvtables-${table}-stretch-mode`, stretchTableMode.value.toString());
  
  // Управление высотой таблицы
  if (stretchTableMode.value) {
    // При включении режима растягивания - убираем ограничение по высоте
    savedScrollHeight = tableScrollHeight.value; // Сохраняем текущее значение
    tableScrollHeight.value = null;
  } else {
    // При выключении - восстанавливаем сохраненное значение
    tableScrollHeight.value = savedScrollHeight || props?.scrollHeight || '85vh';
  }
  
  // Применяем или убираем стили растягивания
  applyStretchTableStyles();
  
  // Уведомление пользователя
  if (notify) {
    const message = stretchTableMode.value
      ? 'Режим растягивания включен. Теперь можно масштабировать таблицу на мобильных устройствах.'
      : 'Режим растягивания выключен.';
    notify('info', { detail: message });
  }
};
```

#### 2.3 Создать функцию применения стилей

```javascript
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
};

/**
 * Уничтожение style элемента для режима растягивания
 */
const destroyStretchTableStyleElement = () => {
  if (stretchTableStyleElement) {
    document.head.removeChild(stretchTableStyleElement);
    stretchTableStyleElement = null;
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
  
  // Определяем минимальную ширину таблицы для растягивания
  // Используем сумму минимальных ширин всех видимых колонок
  // или фиксированное значение (например, 200% от ширины экрана)
  const minTableWidth = '200vw'; // или можно рассчитать динамически
  
  const selector = `[data-pc-name="datatable"] > [data-pc-section="tablecontainer"]`;
  
  const innerHTML = `
    /* Растягиваем контейнер таблицы */
    ${selector} {
      min-width: ${minTableWidth} !important;
      width: max-content !important;
      height: auto !important;
      max-height: none !important;
    }
    
    /* Растягиваем саму таблицу */
    ${selector} > table[data-pc-section="table"] {
      min-width: ${minTableWidth} !important;
      width: max-content !important;
    }
    
    /* Убираем ограничение max-width для wrapper */
    .pvtables .p-datatable-wrapper {
      max-width: none !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }
    
    /* Убираем вертикальный скролл */
    .pvtables .p-datatable-scrollable-body {
      overflow-y: visible !important;
      max-height: none !important;
    }
  `;
  
  stretchTableStyleElement.innerHTML = innerHTML;
};
```

#### 2.4 Обновить функцию очистки

```javascript
// В onBeforeUnmount (строка 538)
onBeforeUnmount(() => {
  window.removeEventListener('resize', calculateTableHeight);
  destroyStretchTableStyleElement(); // Добавить эту строку
});
```

#### 2.5 Экспортировать новые функции

```javascript
// В return (строка 542-569)
return {
  // ... существующие экспорты
  // Режим растягивания таблицы
  stretchTableMode,
  onStretchTableModeToggle
};
```

### 3. Интеграция в основной компонент

**Файл:** [`src/PVTables.vue`](../src/PVTables.vue)

#### 3.1 Деструктурировать новые переменные из composable

```javascript
// После строки 895 (в деструктуризации stylesComposable)
const {
  // ... существующие переменные
  // Режим растягивания таблицы
  stretchTableMode,
  onStretchTableModeToggle
} = stylesComposable;
```

#### 3.2 Применить стили при монтировании

```javascript
// В onMounted, после строки 783 (после applyColumnWidths)
// Применяем режим растягивания если он был включен
if (stretchTableMode.value) {
  setTimeout(() => {
    stylesComposable.applyStretchTableStyles();
  }, 300);
}
```

### 4. Альтернативный подход (более простой)

Вместо динамического расчета можно использовать фиксированные значения:

```javascript
const applyStretchTableStyles = () => {
  if (!stretchTableMode.value) {
    destroyStretchTableStyleElement();
    return;
  }
  
  createStretchTableStyleElement();
  
  // Простой подход: устанавливаем фиксированную большую ширину
  const innerHTML = `
    .pvtables .p-datatable-wrapper {
      min-width: 300vw !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }
    
    .pvtables .p-datatable-wrapper table {
      min-width: 300vw !important;
    }
    
    /* Убираем вертикальный скролл */
    .pvtables .p-datatable-scrollable-body {
      overflow-y: visible !important;
      max-height: none !important;
    }
  `;
  
  stretchTableStyleElement.innerHTML = innerHTML;
};
```

## Диаграмма взаимодействия компонентов

```mermaid
graph TD
    A[Пользователь] -->|Переключает| B[ToggleSwitch в Popover]
    B -->|v-model| C[stretchTableMode ref]
    B -->|@change| D[onStretchTableModeToggle]
    D -->|Сохраняет| E[localStorage]
    D -->|Вызывает| F[applyStretchTableStyles]
    F -->|Создает/удаляет| G[style element в head]
    G -->|Применяет CSS| H[DataTable]
    
    I[onMounted] -->|Загружает| E
    E -->|Восстанавливает| C
    C -->|Если true| F
```

## Последовательность реализации

1. **Добавить UI элемент**
   - Добавить [`ToggleSwitch`](../src/PVTables.vue:9) в Popover настроек
   - Разместить после переключателя автоподгонки высоты

2. **Расширить composable usePVTableStyles**
   - Добавить reactive переменную `stretchTableMode`
   - Добавить переменную `savedScrollHeight` для сохранения высоты
   - Реализовать функцию `onStretchTableModeToggle` с управлением `tableScrollHeight`
   - Реализовать функции создания/удаления style элемента
   - Реализовать функцию `applyStretchTableStyles`
   - Добавить очистку в `onBeforeUnmount`
   - Экспортировать новые функции

3. **Интегрировать в PVTables.vue**
   - Деструктурировать новые переменные из composable
   - Применить стили при монтировании компонента

4. **Тестирование**
   - Проверить работу переключателя
   - Проверить сохранение в localStorage
   - Проверить применение стилей
   - Проверить отключение вертикального скролла при включении режима
   - Проверить восстановление высоты при выключении режима
   - Проверить на мобильных устройствах (Android)
   - Проверить возможность масштабирования двумя пальцами

## Технические детали

### Ключ localStorage

```
pvtables-${table}-stretch-mode
```

Где `${table}` - название таблицы из props

### CSS селекторы

- Контейнер таблицы: `[data-pc-name="datatable"] > [data-pc-section="tablecontainer"]`
- Таблица: `[data-pc-name="datatable"] > [data-pc-section="tablecontainer"] > table[data-pc-section="table"]`
- Wrapper: `.pvtables .p-datatable-wrapper`

### Рекомендуемая ширина

- Минимальная: `200vw` (двойная ширина экрана)
- Максимальная: `300vw` (тройная ширина экрана)
- Или динамический расчет на основе количества и ширины колонок

## Возможные улучшения

1. **Динамический расчет ширины**
   - Рассчитывать минимальную ширину на основе количества видимых колонок
   - Учитывать минимальную ширину каждой колонки

2. **Настройка коэффициента растягивания**
   - Добавить InputNumber для выбора коэффициента (2x, 3x, 4x)
   - Сохранять выбранное значение в localStorage

3. **Индикатор режима**
   - Добавить визуальный индикатор в toolbar
   - Показывать иконку когда режим активен

4. **Адаптивность**
   - Автоматически включать режим на мобильных устройствах
   - Определять тип устройства через User Agent или screen width

## Потенциальные проблемы и решения

### Проблема 1: Конфликт с существующими стилями ширины колонок

**Решение:** Использовать `!important` в CSS правилах для режима растягивания

### Проблема 2: Горизонтальная прокрутка может быть неудобной

**Решение:** Добавить подсказку пользователю о возможности масштабирования

### Проблема 3: Режим может не работать на некоторых устройствах

**Решение:** Тестирование на разных устройствах и браузерах, корректировка CSS

### Проблема 4: Конфликт с настройкой автоподгонки высоты

**Решение:** При включении режима растягивания автоматически отключать автоподгонку высоты и устанавливать `tableScrollHeight` в `null`. При выключении - восстанавливать предыдущее значение.

### Проблема 5: Большие таблицы могут занимать много места по вертикали

**Решение:** Это ожидаемое поведение. Пользователь может выключить режим растягивания, если таблица слишком длинная. Можно добавить предупреждение в подсказке переключателя.

## Зависимости

- Vue 3 (reactive, ref)
- PrimeVue (ToggleSwitch, Popover)
- Существующий composable [`usePVTableStyles`](../src/composables/usePVTableStyles.js)
- localStorage API

## Совместимость

- Браузеры: Chrome, Firefox, Safari, Edge (современные версии)
- Мобильные: Android Chrome, iOS Safari
- Не влияет на существующую функциональность
- Обратная совместимость: режим выключен по умолчанию

## Итоговая оценка сложности

- **Сложность реализации:** Низкая
- **Риски:** Минимальные
- **Влияние на существующий код:** Минимальное (только добавление новой функциональности)
