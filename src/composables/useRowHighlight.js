/**
 * Подсветка строк таблицы.
 *
 * Логика:
 *  1. row_setting[id].class / row_setting[id].style — индивидуальные настройки строки (от API/действий)
 *  2. row_class_trigger — условный класс: если data[field] истинно → добавить класс
 *
 * @param {Ref<Object>} row_setting     - { [id]: { class?, style? } }
 * @param {Ref<Object>} row_class_trigger - { field: string, class: string }
 */
export function useRowHighlight(row_setting, row_class_trigger) {

  /** CSS-класс строки */
  const rowClass = (data) => {
    if (row_setting.value[data.id]?.class) {
      return row_setting.value[data.id].class
    }
    if (row_class_trigger.value?.field && data[row_class_trigger.value.field]) {
      return row_class_trigger.value.class
    }
    return undefined
  }

  /** Inline-стиль строки (объект Vue) */
  const rowStyle = (data) => {
    const raw = row_setting.value[data.id]?.style
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

  return { rowClass, rowStyle }
}
