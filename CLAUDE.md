# PVTables — Vue 3 UI фреймворк для gtsERP

## Роль

Библиотека Vue 3 компонентов для построения админ-интерфейсов gtsERP. Обёртка над PrimeVue 4 с интеграцией gtsAPI.

## Подключение

```javascript
// В компоненте gtsERP
import myPVTables from 'pvtables/dist/pvtables'
app.use(myPVTables)  // Регистрирует все компоненты глобально
```

## Ключевые компоненты

### PVTables (главный)

Таблица с фильтрами, сортировкой, пагинацией, inline-редактированием, CRUD.

```vue
<PVTables table="tableName" :actions="actions" ref="tableRef" />
```

Props: `table`, `actions`, `filters`, `sorting`, `reload`, `scrollHeight`, `child`

### PVTabs

Контейнер вкладок. Типы вкладок: `tree`, `filetree`, `form`, `file-gallery`, `component`, `tables`, default (PVTables).

### PVForm

Форма редактирования записи. Поддерживает inline-режим.

```vue
<PVForm v-model="record" :columns="columns" :inline="true" @set-value="onSave" />
```

### Другие компоненты

- `PVMenu` — навигационное меню
- `AutoComplete` / `gtsAutoComplete` — автодополнение с виртуальным скроллом
- `FileGallery` — галерея файлов
- `UniTree` — дерево (sl-vue-tree-next)
- `gtsDate` / `PVDateTime` — выбор даты
- `AdminPanel` — обёртка admin-страницы

## API клиент

```javascript
import apiCtor from 'pvtables/api'
const api = apiCtor('TableName')

await api.read(params)            // GET /api/TableName
await api.create(data)            // PUT /api/TableName
await api.update(id, data)        // POST /api/TableName/id
await api.delete(ids)             // DELETE /api/TableName
await api.get(id)                 // GET одной записи
await api.action('pkg/action')    // Кастомный endpoint
```

## Composables (10 шт.)

| Файл | Назначение |
|------|-----------|
| `usePVTableData.js` | Lazy loading данных |
| `usePVTableFilters.js` | Инициализация и обработка фильтров |
| `usePVTableActions.js` | Обработка действий (head/row) |
| `usePVTableCRUD.js` | openNew, edit, save, delete |
| `usePVTableNavigation.js` | Навигация клавиатурой |
| `usePVTableExpand.js` | Раскрытие вложенных строк |
| `usePVTableCellSelection.js` | Выделение ячеек (Excel-like) |
| `usePVTableStyles.js` | Стили, тёмная тема |
| `useVirtualScroll.js` | Виртуальный скролл |
| `useActionsCaching.js` | Кэширование шаблонов |

## Структура

```
src/
├── PVTables.vue              # Главный компонент (~2500 строк)
├── index.js                  # Экспорт и регистрация плагина
├── components/
│   ├── PVTable.vue           # Обёртка для PVTables
│   ├── PVTab.vue             # Одна вкладка
│   ├── PVTabs.vue            # Контейнер вкладок
│   ├── PVForm.vue            # Форма
│   ├── DataTable/            # Enhanced PrimeVue DataTable
│   ├── AutoComplete/         # Автодополнение
│   ├── FileBrowser/          # Файловый браузер
│   ├── FileGallery/          # Галерея файлов
│   └── ...
├── composables/              # Composition functions
├── services/                 # Бизнес-логика
├── core/                     # Утилиты
├── store/                    # State management
└── locale/                   # i18n (ru)
```

## Сборка

```bash
npm run build        # Vite lib build → dist/pvtables.js + dist/pvtables.cjs
npm run copy_in_gtsapi  # Копирует билд в gtsAPI/assets
```

Собранный файл попадает в `gtsAPI/assets/components/gtsapi/js/web/pvtables/`.

## Документация

- `memory-bank/projectbrief.md` — обзор проекта
- `docs/multiautocomplete-api.md` — MultiAutoComplete API
- `docs/file-gallery-usage.md` — использование FileGallery
- `docs/file-gallery-installation.md` — установка FileGallery
