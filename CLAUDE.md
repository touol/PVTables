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

## GtsAIChat — чат ИИ

`src/components/gtsai/GtsAIChat.vue` — чат, который говорит со шлюзом `/gtsai`
(компонент gtsAI). Здесь он живёт потому, что PVTables есть на каждой странице:
иначе страница вроде расчёта тянула бы второй Vue-app ради одного чата.

```vue
<GtsAIChat setting="raschet" :params="{ raschet_id: raschetId }" />
```

Пропы: `setting` (имя настроек чата в базе — промпт, права, модель), `title`,
`page` / `params` (контекст страницы; из `params` сервер берёт область работы),
`echo` (кнопка «Тест стрима», только для отладочной страницы).

⚠️ Разбор markdown и подсветка кода — `./markdown.js`, подключается
**динамическим import()**: marked + highlight.js это 92 КБ, и в `index-*.js` им
нельзя. После сборки проверять, что `markdown-*.js` остался отдельным чанком.
Языки highlight.js регистрируются поштучно из `lib/core`.

### GtsAIDock — где чат стоит на странице

`src/components/gtsai/GtsAIDock.vue` оборачивает чат и отвечает за место:
`left`, `right`, `top`, `bottom` или `inline` (в потоке страницы). Выбор делает
пользователь кнопками в шапке панели, и он помнится — в `localStorage` этого
браузера, ключ `gtsai_dock_<setting>`. Край панели тянется мышью.

```vue
<!-- кнопка-запускатель своя, открытие через v-model -->
<GtsAIDock setting="raschet" :params="{ raschet_id: raschetId }"
           v-model:open="aiOpen" :launcher="false" />
```

**Почему не Drawer**, хотя на странице расчёта он уже используется для
«Избранного»: чат — не разовый выбор из списка, с ним работают, глядя в
таблицу, а выезжающая панель закрывает те самые строки, о которых спрашивают.
Поэтому панель **закреплённая и отодвигает контент** — `padding` телу документа
по выбранной стороне, а не правка вёрстки каждой страницы.

⚠️ **Привязан ли `v-model:open`, проверяется по `vnode.props`, а не по значению
модели.** Vue приводит ОТСУТСТВУЮЩИЙ Boolean-проп к `false`, поэтому «хост не
передал open» и «хост передал false» неотличимы по значению. На этом виджет
дважды исчезал целиком: он считал, что открытием распоряжается хост, а хост
ничего не передавал, и не рисовалось ни панели, ни кнопки.

⚠️ Кнопка-запускатель гасится пропом `launcher` **только** вместе с
`v-model:open`. Иначе закрытый чат стало бы нечем открыть.

⚠️ `defineModel` компилируется в `useModel` и требует Vue **3.4+**. На странице
Vue приходит из importmap gtsAPI — там 3.4.27, проверено. Если importmap
откатят на 3.3, модель `open` отвалится.

⚠️ Тени берутся из `--gts-shadow` / `--gts-shadow-l`. Своих `rgba()` в
компоненте нет — они не переживают смену схемы.
