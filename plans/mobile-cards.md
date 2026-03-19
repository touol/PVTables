# Мобильное отображение таблиц PVTables

## Контекст

Таблицы gtsERP не помещаются на экране мобильного телефона. Нужно: карточки вместо таблицы, Vue-шаблон карточки в конфиге (компилируется в браузере), виртуальный скроллер (1000+ строк), редактирование через попап. TanTable/DataTable не монтируются на мобиле.

---

## Ключевые решения

### 1. Vue-шаблон карточки в gtsapipackages.js

```javascript
properties: {
  mobile_card: {
    tpl: `
      <div class="flex items-center justify-between">
        <div>
          <div class="font-bold text-base">{{ row.name }}</div>
          <div class="text-sm text-gray-500">{{ row.client }} | {{ row.date }}</div>
        </div>
        <Chip :label="row.status_label" />
      </div>
      <div class="grid grid-cols-3 gap-2 mt-2">
        <div class="text-center border rounded p-1">
          <div class="font-bold">{{ row.sum }}</div>
          <div class="text-xs text-gray-400">Сумма</div>
        </div>
      </div>
    `
  }
}
```

**Доступно в шаблоне:**
- `row` — объект строки (все поля как есть)
- `cols` — массив колонок `{ field, label, type, meta }` (для динамических списков)
- `selectSettings` — словари для select/autocomplete полей (для лейблов и цветов)
- Tailwind CSS, PrimeVue компоненты (Chip, Badge и т.д.) — через глобальную регистрацию

**Если `mobile_card.tpl` не задан** → авто-карточка (см. ниже).

---

### 2. Рантайм-компиляция шаблона

Vue 3 поддерживает компиляцию строки-шаблона в браузере, но требует **full build** (runtime + compiler).

**Изменение vite.config.js в каждом PVExtra компоненте:**
```javascript
// vite.config.js
resolve: {
  alias: {
    'vue': 'vue/dist/vue.esm-bundler.js'  // full build с компилятором
  }
}
```

**Компиляция в useMobileCardConfig.js:**
```javascript
import { defineComponent, h } from 'vue'
// compile доступен только в full build
import { compile } from '@vue/compiler-dom'

function createTplComponent(tplString) {
  const renderFn = new Function('Vue', compile(tplString).code)(await import('vue'))
  return defineComponent({
    props: {
      row: Object,
      cols: Array,
      selectSettings: Object,
    },
    render() {
      return renderFn.call(this)
    }
  })
}
```

**Результат:** `<component :is="tplComponent" :row="row" :cols="cols" :selectSettings="ss" />`

Компонент кешируется после первой компиляции (один раз на таблицу).

---

### 3. Авто-карточка (без tpl в конфиге)

`useMobileCardConfig.js` распределяет поля по ролям автоматически:

```
TITLE_HINTS    = ['name', 'title', 'caption', 'наименование', 'product']
BADGE_HINTS    = ['status', 'state', 'статус', 'состояние']
METRIC_HINTS   = ['sum', 'amount', 'total', 'price', 'qty', 'quantity', 'сумма']
SUBTITLE_HINTS = ['client', 'customer', 'article', 'sku', 'code', 'date', 'клиент']
```

Дополнительно по типам: `decimal/number` → метрики, `select` с небольшим числом значений → badge-кандидат.

Если ничего не совпало: title = первое текстовое поле, metrics = все decimal, остальное в body.

**Дизайн авто-карточки:**
```
┌─────────────────────────────────────────────────┐
│  Название строки                    [Статус]    │  ← title + badge (chip)
│  19.03.2026  |  Клиент                          │  ← subtitle
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐                     │
│  │ 15 000 ₽ │  │  3 шт.   │                     │  ← metrics (сетка)
│  │  Сумма   │  │ Кол-во   │                     │
│  └──────────┘  └──────────┘                     │
├─────────────────────────────────────────────────┤
│  [▼ подробнее]          [✏ Изменить]  [🗑]     │
└─────────────────────────────────────────────────┘
```

Badge цвет → из `selectSettings[field][value].color` (те же цвета что на десктопе).

---

### 4. Два режима скролла

Таблица используется в двух контекстах:

**Режим A — полная страница** (Расчёты, Заказы): таблица занимает весь экран.
- `TanMobileList` имеет `height: 100dvh - toolbar` и `overflow: auto`
- Виртуализатор скроллит внутри контейнера (`getScrollElement: () => containerRef`)

**Режим B — встроена в страницу** (gsRaschet: Детали, Материалы расчёта):
- Над таблицей есть заголовок (Цена), вкладки, навигация
- Таблица НЕ должна иметь собственного скролла — страница скроллится целиком
- Виртуализатор использует `useWindowVirtualizer` из `@tanstack/vue-virtual`
- Тулбар таблицы: `position: sticky; top: 0` — остаётся видимым при скролле страницы

```javascript
// Режим B: скролл окна
import { useWindowVirtualizer } from '@tanstack/vue-virtual'

const virtualizer = useWindowVirtualizer({
  count: computed(() => lineItems.value.length),
  estimateSize: () => 140,
  overscan: 5,
  scrollMargin: listRef.value?.offsetTop ?? 0,
})
```

**Определение режима:**
```
autoFitHeight: true  → scrollMode: 'container'  (режим A)
autoFitHeight: false → scrollMode: 'window'      (режим B)
```

---

### 5. Виртуальный скроллер

`@tanstack/vue-virtual` (уже в зависимостях PVTables):

```javascript
const virtualizer = useVirtualizer({
  count: computed(() => lineItems.value.length),
  getScrollElement: () => parentRef.value,
  estimateSize: () => 140,
  overscan: 5,
  measureElement: el => el?.getBoundingClientRect().height,
})
```

Карточки позиционируются абсолютно (`translateY`), идентично TanTable. При раскрытии аккордеона → `measureElement` пересчитывает высоту.

Загрузка следующей страницы: когда виртуализатор достигает `count - overscan` → `loadMore()`.

---

## Файлы для создания

| Файл | Роль |
|------|------|
| `PVTables/src/useMobileLayout.js` | `isMobile`, `forceDesktop`, `useMobileView` + localStorage |
| `PVTables/src/useMobileCardConfig.js` | Парсинг `tpl` → defineComponent, или авто-определение ролей полей |
| `PVTables/src/useCellRenderer.js` | Вынести из TanTable.vue логику рендера ячеек (decimal, boolean, date, select...) |
| `PVTables/src/components/TanMobileCard.vue` | Авто-карточка (без tpl): title/badge/metrics/accordion + actions |
| `PVTables/src/components/TanMobileList.vue` | Виртуализация + loadMore + Dialog PVForm + head actions |

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `PVTables/src/PVTables.vue` | `v-if="useMobileView"` → TanMobileList, иначе TanTable/DataTable |
| `PVExtra/docs/use_gtsapipackages.md` | Документация `mobile_card.tpl` |
| `vite.config.js` каждого PVExtra | `alias: { 'vue': 'vue/dist/vue.esm-bundler.js' }` |
| `gtsAPI/core/components/gtsapi/api_controllers/traits/TableFieldsTrait.php` | Добавить `mobile_card` в ответ options() |

### Изменение TableFieldsTrait.php — функция options()

`mobile_card` из `properties` не проходит в ответ автоматически — нужно добавить явно в массив `$options` (строки ~302-335):

```php
$options = [
    'fields'           => $fields,
    'actions'          => $actions,
    'selects'          => $this->getSelects($fields),
    'filters'          => $filters,
    'row_class_trigger'=> $row_class_trigger,
    'table_tree'       => $table_tree,
    'limit'            => $rule['properties']['limit'] ?? false,
    'fields_style'     => json_decode($rule['fields_style'], 1),
    // ... существующие опциональные поля ...
    'mobile_card'      => $rule['properties']['mobile_card'] ?? null,  // ДОБАВИТЬ
];
```

**Результат:** фронтенд получает `mobile_card` через `api.options()` → `data.mobile_card` → передаётся в `useMobileCardConfig`.

---

## Фильтры (Drawer + Accordion)

### Тулбар: меню действий вместо отдельных кнопок

Все `headActions` (Создать, Вставить, Удалить, Excel и т.д.) скрываются в одно выпадающее меню:

```vue
<Button icon="pi pi-ellipsis-v" label="Действия" @click="actionsMenu.toggle($event)" />
<Menu ref="actionsMenu" :model="headActionItems" popup />
```

`headActionItems` = `headActions.map(a => ({ label: a.label, icon: a.icon, command: () => onHeadAction(a) }))`

Деструктивные действия (delete) выделяются красным через `class: 'text-red-500'` в модели меню.

---

### Пагинатор

Внизу `TanMobileList` — стандартный мобильный пагинатор:

```vue
<div class="mobile-paginator">
  <Button icon="pi pi-chevron-left" :disabled="first === 0" @click="onPrevPage" text />
  <span>{{ currentPage }} / {{ totalPages }} · {{ totalRecords }} записей</span>
  <Button icon="pi pi-chevron-right" :disabled="isLastPage" @click="onNextPage" text />
</div>
```

Использует те же `first`, `totalRecords`, `lazyParams` из `usePVTableData` что и TanTable. При смене страницы → `loadLazyData()` → virtualizer сбрасывается в начало (`scrollToIndex(0)`).

---

### Кнопка фильтров в тулбаре TanMobileList

```vue
<Button icon="pi pi-filter" @click="filterDrawerVisible = true">
  <Badge v-if="activeFilterCount > 0" :value="activeFilterCount" />
</Button>
```

`activeFilterCount` = количество колонок где `isFilterActive(col.id)` → true.

### Структура Drawer

PrimeVue `<Drawer>` (position="bottom", style="height:80vh") — слайдится снизу:

```
┌─────────────────────────────────────────────────┐
│  Фильтры                          [✕]  [Очистить всё] │
├─────────────────────────────────────────────────┤
│  ▼ Клиент                         [●]           │  ← активный фильтр
│  ┌─────────────────────────────────────────┐    │
│  │  [TanFilterPopoverUI inline]            │    │
│  └─────────────────────────────────────────┘    │
│  ▶ Статус                                       │
│  ▶ Дата создания                                │
│  ▶ Сумма                         [●]            │
└─────────────────────────────────────────────────┘
```

### Реализация

**Composable:** `useTanFilterPopover` — тот же что в TanTable, без изменений.

**`TanFilterPopoverUI`** используется inline внутри каждой панели аккордеона. Компонент позиционируется родителем — в аккордеоне `filterPopoverPos` игнорируется, а `openFilterColId` всегда равен `col.id` панели (т.е. фильтр всегда "открыт" когда панель раскрыта).

```vue
<!-- TanMobileList.vue -->
<Drawer v-model:visible="filterDrawerVisible" position="bottom" style="height:80vh">
  <template #header>
    <span>Фильтры</span>
    <Button label="Очистить всё" @click="clearAllFilters" text />
  </template>

  <Accordion>
    <AccordionPanel v-for="col in filterableCols" :key="col.id">
      <AccordionHeader>
        {{ col.header }}
        <i v-if="isFilterActive(col.id)" class="pi pi-circle-fill text-primary ml-2" />
      </AccordionHeader>
      <AccordionContent>
        <TanFilterPopoverUI
          :openFilterColId="col.id"
          :colType="col.meta?.type"
          :colMeta="col.meta"
          :columnLabel="col.header"
          :serverFilter="colServerFilters[col.id]"
          :matchModes="MATCH_MODES[col.meta?.type] ?? []"
          :matchModeLabels="MATCH_MODE_LABELS"
          :operatorLabels="OPERATOR_LABELS"
          :selectOptions="colChecklistState[col.id]?.all ?? []"
          :checklistAll="colChecklistState[col.id]?.all ?? []"
          :checklistChecked="colChecklistState[col.id]?.checked"
          @apply-server="applyServerFilter(col.id)"
          @clear-all="clearColFilter(col.id)"
          @update:operator="..."
          @update:constraint-value="..."
          @update:constraint-mode="..."
          @add-constraint="addConstraint(col.id, col.meta?.type)"
          @remove-constraint="removeConstraint(col.id, $event)"
          @toggle-checklist="toggleChecklistValue(col.id, $event)"
          @toggle-checklist-all="toggleChecklistAll(col.id)"
        />
      </AccordionContent>
    </AccordionPanel>
  </Accordion>
</Drawer>
```

**filterableCols** = колонки где тип не `hidden` и не `html` (те же что в TanTable).

**clearAllFilters** = вызов `clearColFilter(col.id)` для всех колонок → перезагрузка данных.

### Файлы (дополнение к таблице изменений)

Новых файлов не требуется — всё интегрируется в `TanMobileList.vue` с переиспользованием:
- `useTanFilterPopover` (без изменений)
- `TanFilterPopoverUI.vue` (без изменений)
- PrimeVue `Drawer`, `Accordion`, `AccordionPanel`, `AccordionHeader`, `AccordionContent`

---

## Выделение строк (чекбоксы)

На десктопе "выбрать все" — чекбокс в заголовке таблицы. На мобиле заголовка нет.

### Тулбар: чекбокс "выбрать все"

```vue
<Checkbox v-model="allSelected" :indeterminate="someSelected" @change="toggleSelectAll" />
```

- `allSelected` = true когда все видимые строки выбраны
- `indeterminate` = true когда выбрана часть строк
- Размещается в левой части тулбара перед кнопками действий

### Плавающая панель bulk-actions

Когда выбрана хотя бы одна строка → появляется панель снизу над клавиатурой:

```
┌─────────────────────────────────────────────────┐
│  Выбрано: 3                  [🗑 Удалить]  [✕]  │
└─────────────────────────────────────────────────┘
```

- Позиционирована `fixed; bottom: 0` с анимацией slide-up
- Показывает count выбранных строк
- Кнопки bulk-действий (delete и другие из `headActions` где `bulk: true`)
- `[✕]` — снять выделение со всех

### Состояние

```javascript
const selectedIds = ref(new Set())
const allSelected = computed(() => selectedIds.value.size === lineItems.value.length && lineItems.value.length > 0)
const someSelected = computed(() => selectedIds.value.size > 0 && !allSelected.value)

function toggleSelectAll() {
  if (allSelected.value) selectedIds.value.clear()
  else lineItems.value.forEach(row => selectedIds.value.add(row.id))
}
```

Чекбокс в каждой карточке: `v-model` через `selectedIds.has(row.id)` / `toggle(row.id)`.

---

## Редактирование

В `TanMobileList.vue`:
```vue
<Dialog v-model:visible="editVisible" modal>
  <PVForm :table="table" :row="editingRow" @saved="onSaved" @cancel="editVisible=false" />
</Dialog>
```

---

## Порядок реализации

1. `TableFieldsTrait.php` — добавить `mobile_card` в ответ options()
2. `useMobileLayout.js`
3. `useCellRenderer.js` (рефакторинг из TanTable.vue без изменения поведения)
4. `useMobileCardConfig.js` (авто-определение ролей + compile(tpl))
5. `TanMobileCard.vue` (авто-карточка)
6. `TanMobileList.vue` (виртуализация + редактирование)
7. Интеграция в `PVTables.vue`
8. Изменение vite.config.js в PVExtra компонентах
9. `use_gtsapipackages.md` документация
10. Добавить `mobile_card.tpl` в gsRaschets (первый тест)

---

## Проверка

1. DevTools → мобильный (< 768px) → карточки, TanTable не в DOM
2. Компонент с `tpl` → Vue-шаблон компилируется и рендерится, `row.name` работает
3. Компонент без `tpl` → авто-карточка с правильными title/badge/metrics
4. 1000 строк → виртуальный скролл плавный
5. Раскрыть аккордеон → virtualizer пересчитывает высоту карточки
6. "Изменить" → Dialog с PVForm, сохранение работает
7. "Полная таблица" → TanTable, флаг в localStorage
8. Реальный телефон: тач-скролл, читаемость

---

## Файлы планирования

- [mobile-cards.md](mobile-cards.md) — этот файл (актуальный план)
- [mobile-prototype.html](mobile-prototype.html) — HTML прототипы мобильных карточек
