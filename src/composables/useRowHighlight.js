/**
 * Подсветка строк и ячеек таблицы.
 *
 * row_setting приходит от API/действий в формате:
 *   {
 *     [id]: {
 *       class?:  string,           // CSS-класс строки
 *       style?:  string|object,    // inline-стиль строки
 *       cells?: {
 *         [field]: {
 *           class?: string,        // CSS-класс ячейки
 *           style?: string|object  // inline-стиль ячейки
 *         }
 *       }
 *     }
 *   }
 *
 * row_class_trigger — условный класс строки:
 *   { field, class }            → если data[field] истинно (truthy);
 *   { field, value, class }     → если data[field] == value (или входит в массив value).
 *
 * @param {Ref<Object>} row_setting
 * @param {Ref<Object>} row_class_trigger
 */
export function useRowHighlight(row_setting, row_class_trigger) {

  const parseStyle = (raw) => {
    if (!raw) return {}
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      const obj = {}
      raw.split(';').forEach(rule => {
        const trimmed = rule.trim()
        if (!trimmed) return
        const colon = trimmed.indexOf(':')
        if (colon > 0) {
          const prop  = trimmed.slice(0, colon).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
          const value = trimmed.slice(colon + 1).trim()
          obj[prop] = value
        }
      })
      return obj
    }
    return {}
  }

  /** CSS-класс строки */
  const rowClass = (data) => {
    if (row_setting.value[data.id]?.class) {
      return row_setting.value[data.id].class
    }
    const trig = row_class_trigger.value
    if (trig?.field) {
      const v = data[trig.field]
      // Если задан value — сравниваем по значению (или вхождению в массив),
      // иначе — старое поведение по truthy.
      const match = trig.value !== undefined
        ? (Array.isArray(trig.value) ? trig.value.some(x => x == v) : trig.value == v)
        : !!v
      if (match) return trig.class
    }
    return undefined
  }

  /** Inline-стиль строки */
  const rowStyle = (data) => parseStyle(row_setting.value[data.id]?.style)

  /** CSS-класс ячейки */
  const cellClass = (data, field) => {
    if (!data || field == null) return undefined
    const cells = row_setting.value[data.id]?.cells
    return cells?.[field]?.class
  }

  /** Inline-стиль ячейки */
  const cellStyle = (data, field) => {
    if (!data || field == null) return {}
    const cells = row_setting.value[data.id]?.cells
    return parseStyle(cells?.[field]?.style)
  }

  return { rowClass, rowStyle, cellClass, cellStyle }
}
