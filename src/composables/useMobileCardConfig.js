import { defineComponent, computed } from 'vue'
import * as Vue from 'vue'
import { compile } from '@vue/compiler-dom'

// ─── Эвристики автоопределения ролей полей ────────────────────────────────

const TITLE_HINTS    = ['name', 'title', 'caption', 'наименование', 'product', 'description']
const BADGE_HINTS    = ['status', 'state', 'статус', 'состояние']
const METRIC_HINTS   = ['sum', 'amount', 'total', 'price', 'qty', 'quantity', 'сумма', 'количество', 'цена', 'итого']
const SUBTITLE_HINTS = ['client', 'customer', 'article', 'sku', 'code', 'date', 'клиент', 'артикул', 'дата', 'заказчик']

function fieldMatchesHints(fieldName, hints) {
  const f = fieldName.toLowerCase()
  return hints.some(h => f.includes(h.toLowerCase()))
}

/**
 * Авто-определение ролей полей по именам и типам.
 *
 * @param {Array} cols — массив колонок { field, label, type, ... }
 * @returns {{ titleField, badgeField, subtitleFields, metricFields, bodyFields }}
 */
export function detectCardRoles(cols) {
  const visible = cols.filter(c => c.type !== 'hidden' && c.field !== 'id')

  let titleField    = null
  let badgeField    = null
  const subtitleFields = []
  const metricFields   = []
  const bodyFields     = []

  for (const col of visible) {
    if (!titleField && (fieldMatchesHints(col.field, TITLE_HINTS) || fieldMatchesHints(col.label || '', TITLE_HINTS))) {
      titleField = col; continue
    }
    if (!badgeField && (col.type === 'select') &&
        (fieldMatchesHints(col.field, BADGE_HINTS) || fieldMatchesHints(col.label || '', BADGE_HINTS))) {
      badgeField = col; continue
    }
    if ((col.type === 'decimal' || col.type === 'number') &&
        (fieldMatchesHints(col.field, METRIC_HINTS) || fieldMatchesHints(col.label || '', METRIC_HINTS))) {
      metricFields.push(col); continue
    }
    if (fieldMatchesHints(col.field, SUBTITLE_HINTS) || fieldMatchesHints(col.label || '', SUBTITLE_HINTS)) {
      subtitleFields.push(col); continue
    }
    bodyFields.push(col)
  }

  // Fallback: если нет title — берём первое текстовое поле
  if (!titleField) {
    const idx = bodyFields.findIndex(c => !c.type || c.type === 'text' || c.type === 'view')
    if (idx !== -1) { titleField = bodyFields[idx]; bodyFields.splice(idx, 1) }
    else if (visible.length > 0) { titleField = visible[0] }
  }

  // Fallback: если нет метрик — все decimal идут в метрики
  if (metricFields.length === 0) {
    const idxs = []
    bodyFields.forEach((c, i) => { if (c.type === 'decimal' || c.type === 'number') idxs.push(i) })
    for (let i = idxs.length - 1; i >= 0; i--) {
      metricFields.push(...bodyFields.splice(idxs[i], 1))
    }
  }

  return { titleField, badgeField, subtitleFields, metricFields, bodyFields }
}

// ─── Кеш скомпилированных компонентов ────────────────────────────────────
const tplCache = new Map()

/**
 * Компилирует строку Vue-шаблона в компонент (lazy, кешируется).
 *
 * ВАЖНО: требует Vue full build (vue/dist/vue.esm-bundler.js) в vite.config.js:
 *   resolve: { alias: { 'vue': 'vue/dist/vue.esm-bundler.js' } }
 *
 * @param {string} tplString — шаблон Vue без <template> тегов
 * @returns {Object|null} defineComponent или null при ошибке
 */
export function compileTplComponent(tplString) {
  if (tplCache.has(tplString)) return tplCache.get(tplString)

  let comp = null
  try {
    const { code } = compile(tplString, { mode: 'function' })
    // eslint-disable-next-line no-new-func
    const renderFn = new Function('Vue', code)(Vue)

    comp = defineComponent({
      props: {
        row:            { type: Object,  default: () => ({}) },
        cols:           { type: Array,   default: () => [] },
        selectSettings: { type: Object,  default: () => ({}) },
      },
      setup(props) {
        return () => renderFn(props, [])
      },
    })
  } catch (e) {
    console.warn('[useMobileCardConfig] Ошибка компиляции tpl:', e)
    comp = null
  }

  tplCache.set(tplString, comp)
  return comp
}

/**
 * Основной composable.
 *
 * @param {Ref<Object|null>} mobileCardConfig — reactive ref из api.options() → data.mobile_card
 * @param {Ref<Array>}       columns          — reactive ref колонок таблицы
 * @returns {{ cardRoles, tplComponent }}
 */
export function useMobileCardConfig(mobileCardConfig, columns) {
  const cardRoles = computed(() => detectCardRoles(columns.value ?? []))

  const tplComponent = computed(() => {
    const tpl = mobileCardConfig.value?.tpl
    if (!tpl) return null
    return compileTplComponent(tpl)
  })

  const articleComponent = computed(() => {
    const tpl = mobileCardConfig.value?.article
    if (!tpl) return null
    return compileTplComponent(tpl)
  })

  return { cardRoles, tplComponent, articleComponent }
}
