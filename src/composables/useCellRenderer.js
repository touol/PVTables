/**
 * Форматтеры значений ячеек — переиспользуются в TanTable и TanMobileCard.
 */

export const formatDate = (v) => {
  if (!v) return ''
  return v.split('-').reverse().join('.')
}

export const formatDateTime = (v) => {
  if (!v) return ''
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!m) return v
  const [, y, mo, d, hh = '', mm = ''] = m
  return hh ? `${d}.${mo}.${y} ${hh}:${mm}` : `${d}.${mo}.${y}`
}

export const formatDecimal = (text, fractionDigits = 2) => {
  if (text === '' || text == null) text = 0
  const parts = parseFloat(text).toFixed(fractionDigits).toString().split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return parts.join(',')
}

export const truncateText = (text, max) => {
  if (!text) return ''
  const s = String(text)
  return s.length <= max ? s : s.slice(0, max) + '…'
}

/**
 * Возвращает текстовое значение ячейки для отображения в карточке.
 *
 * @param {Object} col         — определение колонки { field, type, ... }
 * @param {*}      value       — значение поля
 * @param {Object} row         — полная строка данных
 * @param {Object} acMaps      — Map: field → Map<id, content>
 * @param {Object} acFullMaps  — Map: field → Map<id, fullRow>
 * @param {Object} selectMaps  — Map: field → Map<id, label>
 * @param {Object} customFieldsForRow — customFields[row.id] или {}
 * @returns {string}
 */
export function renderCellText(col, value, row, acMaps, acFullMaps, selectMaps, customFieldsForRow = {}) {
  if (value === null || value === undefined || value === '') return ''

  switch (col.type) {
    case 'decimal':
      return formatDecimal(value, col.FractionDigits)

    case 'boolean':
      return value == 1 || value === true ? 'Да' : 'Нет'

    case 'date':
      return formatDate(value)

    case 'datetime':
      return formatDateTime(value)

    case 'html':
      // plain text strip
      return String(value).replace(/<[^>]*>/g, '')

    case 'autocomplete': {
      if (!value || value == 0) return ''
      const lbl = acMaps?.[col.field]?.get(String(value)) ?? ''
      if (col.hide_id) return lbl || String(value)
      if (col.show_id) {
        const fullRow = acFullMaps?.[col.field]?.get(String(value))
        const sv = fullRow?.[col.show_id]
        const showVal = (sv !== null && sv !== undefined && sv !== '' && sv != 0) ? sv : value
        return `${showVal} ${lbl}`.trim()
      }
      return `${value} ${lbl}`.trim()
    }

    case 'select': {
      const lbl = selectMaps?.[col.field]?.get(String(value))
      if (lbl) return lbl
      // fallback из customFields строки
      const cfRows = customFieldsForRow?.[col.field]?.select_data
      if (cfRows) {
        const found = cfRows.find(o => String(o.id) === String(value))
        if (found) return found.content ?? found.label ?? String(value)
      }
      return String(value)
    }

    default: {
      const s = String(value)
      if (col.truncate && s.length > col.truncate) return truncateText(s, col.truncate)
      return s
    }
  }
}

/**
 * Возвращает объект { label, color } для select/autocomplete полей.
 * Используется для цветных бейджей в карточке.
 */
export function getSelectBadge(col, value, selectSettings) {
  if (!value && value !== 0) return null
  const rows = selectSettings?.[col.field]?.rows
  if (!rows) return null
  const found = rows.find(r => String(r.id) === String(value))
  if (!found) return null
  return { label: found.content ?? found.label ?? String(value), color: found.color ?? null }
}
