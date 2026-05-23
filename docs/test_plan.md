# План автотестов PVTables

**Цель:** ловить регрессии в PVTables (Vue 3 + PrimeVue + TanStack Table) до push'а. PVTables используется в pvSklad, vk24Snab, SkladMake2, Squd, OrgStructure — регрессия ломает сразу несколько модулей.

**Дата плана:** 22.05.2026.
**Связано:** [GtsApiTests](v:/OSPanel/home/modx.pl/public/Extras/GtsApiTests/) (backend-сторона уже покрыта smoke.php).

---

## Что покрываем (приоритеты на основе регрессий 18-22.05)

### Критические зоны (точно тестировать):
1. **Filter popovers** ([TanFilterPopoverUI.vue](v:/OSPanel/home/modx28.loc/public/Extras/PVTables/src/components/TanFilterPopoverUI.vue), [useTanFilterPopover.js](v:/OSPanel/home/modx28.loc/public/Extras/PVTables/src/composables/useTanFilterPopover.js))
   - input type для каждого colType (text/date/datetime/numeric)
   - MATCH_MODES для каждого типа
   - buildUniqueValues — boolean → Да/Нет, числа, даты
   - Section labels («Фильтр базы» / «Фильтр браузера»)
2. **Column sizing** ([useTanColSizing.js](v:/OSPanel/home/modx28.loc/public/Extras/PVTables/src/composables/useTanColSizing.js), [TanColSizePopoverUI.vue](v:/OSPanel/home/modx28.loc/public/Extras/PVTables/src/components/TanColSizePopoverUI.vue))
   - autoFitCols=false при ручном resize
   - saveWidthsToLocal/Server включает ВСЕ visibleColumns
   - cog popover (touch) slider + input sync
3. **TanTable rendering** ([TanTable.vue](v:/OSPanel/home/modx28.loc/public/Extras/PVTables/src/components/TanTable.vue))
   - row_setting.class — применяется к `<tr>` (hit/work/attention)
   - frozen columns left/right — sticky + background при row.hit/.work
   - embeddedInRow scale-down активен только в row-expansion
   - borders #94a3b8 (regression 22.05)
4. **PVTabs** — динамические tabs из data, tabFilters merge с глобальными filters.
5. **Edit cells** (TanEditCell) — validation, save через CRUD, error display.

### Важные но не первоочередные:
- Pagination, sortby, expansion subrows
- TanMobileList (мобильный вид)
- File upload, image preview
- Drag-and-drop reorder

---

## 3 фазы

### Фаза 1 — Vitest unit-тесты для composables (~3 ч)

**Стек:** `vitest` (уже в node_modules или ставим), `@vue/test-utils`, `happy-dom` (быстрее jsdom).

**Где живёт:**
```
Extras/PVTables/tests/unit/
  useTanFilterPopover.test.js
  useTanColSizing.test.js
  setup.js              # global mocks (window, document)
```

**Покрытие:**

```js
// useTanFilterPopover.test.js
describe('MATCH_MODES', () => {
  it('datetime → [dateAfter, dateBefore, equals]')
  it('date → стандартный набор')
  it('boolean → equals')
  it('numeric → equals, lt, gt, lte, gte, between')
})

describe('buildUniqueValues', () => {
  it('boolean: true/1/"1"/"true" → "Да", остальное → "Нет"')
  it('date: уникальные YYYY-MM-DD из массива')
  it('text: уникальные строки')
})

// useTanColSizing.test.js
describe('autoFitCols', () => {
  it('onResizeMouseDown выставляет autoFitCols=false')
  it('saveWidthsToLocal сохраняет ВСЕ visibleColumns (override + default)')
  it('saveFieldsStyleToServer тоже использует ALL visibleColumns')
  it('reset восстанавливает default sizes')
})
```

**Запуск:** `npx vitest run` или `npm test` (после добавления script в package.json).

---

### Фаза 2 — Vitest component-тесты в jsdom (~4 ч)

**Покрытие:**

```
Extras/PVTables/tests/component/
  TanFilterPopoverUI.test.js
  TanColSizePopoverUI.test.js
  TanTable.test.js
  PVTabs.test.js
```

**Примеры:**

```js
// TanFilterPopoverUI.test.js
describe('input type по colType', () => {
  it('colType=date → <input type="date">')
  it('colType=datetime → <input type="datetime-local">')
  it('colType=text → <input type="text">')
  it('colType=numeric → <input type="number">')  // если есть
})
describe('секция labels', () => {
  it('видна "Фильтр базы" и "Фильтр браузера"')
  it('желтая подсказка для "Фильтр браузера" про current-page-only scope')
})

// TanTable.test.js
describe('row_setting', () => {
  it('row.hit получает class "hit" → background #60cc2fe6')
  it('row.work → class "work" → #89d7f1')
  it('row.attention → класс выставляется И на frozen ячейках')
})
describe('borders', () => {
  it('.tan-th border = #94a3b8')
  it('.tan-td border-right + border-bottom (без top/left)')
})

// PVTabs.test.js
describe('динамические tabs', () => {
  it('tabs computed из data.orders → отрисовываются')
  it('tabFilters мерджатся с globalFilters при смене вкладки')
})
```

---

### Фаза 3 — Playwright e2e поверх GtsApiTests/pvSklad (~4 ч)

**Стек:** `@playwright/test`. Запуск на реальном браузере (Chromium) с dev-сайтом modx.local. Использует уже-готовый бэкенд GtsApiTests (4 таблицы с фикстурами) — не делаем собственный mock.

**Структура:**
```
Extras/PVTables/tests/e2e/
  playwright.config.js
  fixtures.js           # login as Administrator через UI или cookie
  filter.spec.js
  resize.spec.js
  pvtabs.spec.js
  full-flow.spec.js
```

**Сценарии:**

```js
// filter.spec.js — реальный фильтр на странице GtsTestProduct
test('фильтр equals — таблица показывает 1 строку', async ({ page }) => {
  await page.goto('/manager/...');  // или прямой URL страницы с PVTables
  await page.locator('.tan-filter-btn[data-field="name"]').click();
  await page.locator('select.tan-filter-mode').selectOption('equals');
  await page.locator('.tan-filter-popover-input').fill('Beta');
  await page.locator('.tan-filter-action-apply').click();
  await expect(page.locator('.tan-row')).toHaveCount(1);
  await expect(page.locator('.tan-row .tan-td').first()).toContainText('Beta');
});

// resize.spec.js
test('drag resize выключает autoFit и сохраняет ширину', async ({ page }) => {
  // ...
});
```

**Auth:** через ?api_token или сохранённую cookie-сессию (фикстура).

**Backend:** перед прогоном e2e — убедиться что dev-сайт поднят и GtsApiTests установлен (вызов `php Extras/GtsApiTests/tests/smoke.php` health-check).

---

## Pipeline

**npm test script** (добавить в `package.json`):
```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:component": "vitest run tests/component",
    "test:e2e": "playwright test"
  }
}
```

**Хук в `npm run build`** ([build/copy_in_gtsapi.js](v:/OSPanel/home/modx28.loc/public/Extras/PVTables/build/copy_in_gtsapi.js) или main build):
```js
// после успешной сборки
import { execSync } from 'child_process';
try {
  console.log('═══ PVTables tests ═══');
  execSync('npx vitest run', { stdio: 'inherit' });
  console.log('✓ Tests OK');
} catch (e) {
  console.error('⚠️  Tests FAILED — регрессии надо чинить ДО push в gtsAPI');
  // НЕ блокируем build (он уже отработал dist/), но громко орём.
}
```

E2E запускается отдельно командой `npm run test:e2e` — не в каждом build (медленно, требует поднятого браузера).

---

## Регрессии-якоря (что точно должно ловиться)

Эти регрессии уже ловили в продакшене за последние 2 недели — каждая должна иметь свой тест:

1. **18.05** — resize столбца сбрасывал другие через ResizeObserver → `useTanColSizing.test.js::saveWidthsToLocal saves all visible columns`.
2. **19.05** — datetime фильтр type=text вместо datetime-local → `TanFilterPopoverUI.test.js::colType=datetime → datetime-local`.
3. **20.05** — boolean filter true/false вместо Да/Нет → `useTanFilterPopover.test.js::buildUniqueValues boolean → Да/Нет`.
4. **21.05** — `&$rule, &$fields` в `TableTriggerTrait::run_triggers` сломал by-ref → backend-сторона ([GtsApiTests](v:/OSPanel/home/modx.pl/public/Extras/GtsApiTests/) `trigger_byref_no_fatal`).
5. **21.05** — поля без `class:` молча ломают фильтр → backend ([GtsApiTests](v:/OSPanel/home/modx.pl/public/Extras/GtsApiTests/) `regression_field_without_class`).
6. **22.05** — borders #cbd5e1 → #94a3b8 → `TanTable.test.js::borders color = #94a3b8`.

---

## Что НЕ покрываем сразу

- **Visual regression (скриншоты)** — дорого по поддержке. Делать только если будут жалобы на CSS-регрессии.
- **Cross-browser** — только Chromium. Firefox/Safari позже если нужно.
- **Mobile-touch жесты** — TanColSizePopoverUI cog проверяется через unit тест, реальный touch через Playwright только при необходимости.
- **Drag-and-drop reorder** — низкий приоритет, регрессий не было.

---

## Время факт vs план

| Фаза | План | Что делаем |
|---|---|---|
| 1 — composables | 3 ч | Vitest setup + 2 файла unit |
| 2 — components | 4 ч | Component tests с happy-dom |
| 3 — e2e | 4 ч | Playwright setup + 4 spec файла |
| **Итого** | **11 ч** | |

С опытом GtsApiTests (где много времени ушло на shape ответов) — здесь риск похожий на этапе e2e (selectors hit-and-miss). Заложу +2 ч буфера на e2e.
