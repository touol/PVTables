# Задача 1: Модификация сортировки с тремя состояниями

## Описание задачи

Реализовать трехступенчатую сортировку при клике на заголовок таблицы:
- **1-й клик**: сортировка по возрастанию (ASC, order: 1)
- **2-й клик**: сортировка по убыванию (DESC, order: -1)
- **3-й клик**: отмена сортировки по этому столбцу (удаление из multiSortMeta)

Дополнительно: кнопка "Очистить фильтры" должна также очищать все сортировки.

## Файлы для изменения

### 1. src/components/DataTable/DataTable.vue

**Местоположение:** Метод `addMultiSortField` (строка ~1329)

**Текущая логика:**
```javascript
addMultiSortField(field) {
    let index = this.d_multiSortMeta.findIndex((meta) => meta.field === field);

    if (index >= 0) {
        if (this.removableSort && this.d_multiSortMeta[index].order * -1 === this.defaultSortOrder) 
            this.d_multiSortMeta.splice(index, 1);
        else 
            this.d_multiSortMeta[index] = { field: field, order: this.d_multiSortMeta[index].order * -1 };
    } else {
        this.d_multiSortMeta.push({ field: field, order: this.defaultSortOrder });
    }

    this.d_multiSortMeta = [...this.d_multiSortMeta];
}
```

**Новая логика (3 состояния):**
```javascript
addMultiSortField(field) {
    let index = this.d_multiSortMeta.findIndex((meta) => meta.field === field);

    if (index >= 0) {
        const currentOrder = this.d_multiSortMeta[index].order;
        
        // Если текущий порядок = 1 (ASC), меняем на -1 (DESC)
        if (currentOrder === 1) {
            this.d_multiSortMeta[index] = { field: field, order: -1 };
        } 
        // Если текущий порядок = -1 (DESC), удаляем сортировку (3-й клик)
        else if (currentOrder === -1) {
            this.d_multiSortMeta.splice(index, 1);
        }
    } else {
        // Поле не в массиве - добавляем с order: 1 (ASC)
        this.d_multiSortMeta.push({ field: field, order: this.defaultSortOrder });
    }

    this.d_multiSortMeta = [...this.d_multiSortMeta];
}
```

**Альтернативный вариант (более универсальный):**
```javascript
addMultiSortField(field) {
    let index = this.d_multiSortMeta.findIndex((meta) => meta.field === field);

    if (index >= 0) {
        const currentOrder = this.d_multiSortMeta[index].order;
        
        // Переключение: 1 → -1 → удаление
        if (currentOrder === this.defaultSortOrder) {
            // Первое состояние → второе (инверсия)
            this.d_multiSortMeta[index] = { field: field, order: currentOrder * -1 };
        } else {
            // Второе состояние → удаление (третий клик)
            this.d_multiSortMeta.splice(index, 1);
        }
    } else {
        // Добавление нового поля с дефолтным порядком
        this.d_multiSortMeta.push({ field: field, order: this.defaultSortOrder });
    }

    this.d_multiSortMeta = [...this.d_multiSortMeta];
}
```

### 2. src/PVTables.vue

**Местоположение:** Метод `clearFilter` (строка ~298)

**Текущий код:**
```javascript
const clearFilter = async () => {
    initFilters();
    // lazyParams.value.filters = filters.value;
    await loadLazyData();
};
```

**Новый код (с очисткой сортировки):**
```javascript
const clearFilter = async () => {
    initFilters();
    
    // Очистка сортировки
    lazyParams.value.multiSortMeta = [];
    
    await loadLazyData();
};
```

## Логика работы

### Состояния сортировки для одного столбца:

1. **Нет сортировки** (поле отсутствует в `d_multiSortMeta`)
   - Клик → добавить `{ field: 'fieldName', order: 1 }`
   - Иконка: `SortAltIcon` (нейтральная)

2. **Сортировка ASC** (`order: 1`)
   - Клик → изменить на `{ field: 'fieldName', order: -1 }`
   - Иконка: `SortAmountUpAltIcon` (стрелка вверх)

3. **Сортировка DESC** (`order: -1`)
   - Клик → удалить из массива `splice(index, 1)`
   - Иконка: `SortAmountDownIcon` (стрелка вниз)

### Множественная сортировка:

- При зажатом `Ctrl/Cmd` можно сортировать по нескольким столбцам
- Каждый столбец проходит через 3 состояния независимо
- Badge показывает порядок сортировки (1, 2, 3...)

## Тестирование

### Тест 1: Одиночная сортировка
1. Кликнуть на заголовок столбца → проверить ASC
2. Кликнуть еще раз → проверить DESC
3. Кликнуть третий раз → проверить отмену сортировки

### Тест 2: Множественная сортировка
1. Кликнуть на столбец A → ASC
2. Ctrl+клик на столбец B → ASC (badge 2)
3. Кликнуть на столбец A → DESC
4. Кликнуть на столбец A → отмена (badge на B становится 1)

### Тест 3: Очистка фильтров
1. Установить сортировку на несколько столбцов
2. Нажать кнопку "Очистить фильтры"
3. Проверить, что все сортировки сброшены

## Возможные проблемы и решения

### Проблема 1: Иконки не обновляются
**Решение:** Убедиться, что `d_multiSortMeta` обновляется реактивно через `[...this.d_multiSortMeta]`

### Проблема 2: Badge не исчезает при удалении сортировки
**Решение:** Проверить computed свойство `isMultiSorted()` в HeaderCell.vue

### Проблема 3: Конфликт с `removableSort` prop
**Решение:** Новая логика работает независимо от `removableSort`, можно игнорировать этот prop

## Дополнительные улучшения (опционально)

1. **Визуальная индикация третьего состояния:**
   - Можно добавить тултип "Кликните еще раз для отмены сортировки"

2. **Анимация перехода:**
   - Плавная смена иконок при переключении состояний

3. **Сохранение состояния:**
   - Если используется `stateStorage`, сортировка сохраняется автоматически
