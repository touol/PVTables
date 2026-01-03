# Автоматический расчет высоты таблиц в UniTreePanel

## Дата: 03.01.2026

## Задача
Реализовать автоматический расчет высоты для таблиц, загружаемых во вкладки правой части UniTreePanel, чтобы все таблицы были видимыми и помещались в область экрана.

## Проблема
- Во вкладку может подгружаться 1 или 2 таблицы (тип `tables` в конфигурации)
- Таблицы наезжали друг на друга
- Не было автоматического деления пространства между таблицами

## Решение

### 1. UniTreePanel.vue
Убраны стили для таблиц, которые вызывали конфликты:
```css
/* УДАЛЕНО */
.tree-panel-container .p-tabpanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 10px;
  padding: 10px;
}
```

### 2. PVTabs.vue
Добавлена логика автоматического расчета `scrollHeight` для таблиц:

#### Добавленные refs:
```vue
<Tabs v-model:value="key0" ref="tabsRef">
  <TabPanels ref="tabPanelsRef">
```

#### Функция расчета высоты:
```javascript
const calculateTableScrollHeight = (tablesCount = 1) => {
  // Получаем высоту окна и позицию TabPanels
  const windowHeight = window.innerHeight
  const tabPanelsTop = rect.top
  
  // Резервируем место для элементов таблицы:
  const bottomPadding = 20        // отступ снизу
  const toolbarHeight = 60        // тулбар таблицы
  const headerHeight = 40         // заголовки колонок
  const paginatorHeight = 50      // пагинация
  const gapBetweenTables = tablesCount > 1 ? 10 * (tablesCount - 1) : 0
  const additionalPadding = 40    // дополнительные отступы
  
  // Рассчитываем доступную высоту
  const availableHeight = windowHeight - tabPanelsTop - bottomPadding - additionalPadding
  const heightPerTable = (availableHeight - gapBetweenTables) / tablesCount
  const scrollHeight = heightPerTable - toolbarHeight - headerHeight - paginatorHeight
  
  // Минимальная высота 200px
  return `${Math.max(200, scrollHeight)}px`
}
```

#### Передача scrollHeight в PVTables:
```vue
<PVTables 
  :scrollHeight="tableScrollHeights[table.key] || '400px'"
  ...
/>
```

#### Watchers и lifecycle:
```javascript
// Следим за изменением активной вкладки
watch(key0, () => {
  updateTableHeights()
})

// Пересчитываем при изменении размера окна
onMounted(() => {
  window.addEventListener('resize', updateTableHeights)
  updateTableHeights()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateTableHeights)
})
```

## Результат
- **1 таблица** → занимает ~99% доступного пространства
- **2 таблицы** → делят пространство примерно 50/50 с учетом отступов
- **3+ таблиц** → делят пространство поровну

## ⚠️ Известные проблемы

### Для 2 таблиц мало места
При делении пространства на 2 таблицы каждая получает примерно по 200-300px высоты (в зависимости от разрешения экрана), что может быть недостаточно для комфортной работы.

**Возможные решения для будущего:**
1. Добавить возможность сворачивания/разворачивания таблиц (accordion)
2. Использовать вертикальный Splitter для ручного изменения размеров
3. Добавить кнопку "развернуть на весь экран" для каждой таблицы
4. Использовать табы внутри вкладки вместо одновременного отображения
5. Увеличить минимальную высоту и добавить вертикальный скролл для всей вкладки

## Примеры конфигурации

### Одна таблица:
```javascript
parametrs:{
  title:'Параметры',
  table:'gsProductParam',
  where: {
    "product_id": "current_id",
  }
}
```

### Две таблицы:
```javascript
variables:{
  title:'Переменные',
  type:'tables',
  tables:{
    variables_default:{
      table:'gsDefaultVariable',
      where: {
        "insert_menu_id": "current_id",
      }
    },
    variables_product:{
      table:'gsProductVariable2',
      where: {
        "product_id": "current_id",
      }
    },
  }
}
```

## Файлы изменены
- `src/components/UniTreePanel.vue` - убраны конфликтующие стили
- `src/components/PVTabs.vue` - добавлена логика расчета высоты таблиц

## Связанные файлы
- `src/PVTables.vue` - принимает prop `scrollHeight`
- `src/composables/usePVTableStyles.js` - содержит функцию `calculateTableHeight` для auto-fit режима
- `../gtsShopAdmin/_build/configs/gtsapipackages.js` - конфигурация таблиц
