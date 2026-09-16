/**
 * Таблица, в которой ищет автокомплит поля.
 *
 * Обычно это просто field.table. Но таблицу можно переключать по значению
 * соседнего поля той же строки:
 *
 *   mat_id: {
 *     type: 'autocomplete',
 *     table: 'raschetsMaterial',                              // по умолчанию
 *     table_by: { field: 'type_id', map: { 6: 'PVPdItem' } }, // переключение
 *   }
 *
 * Нет строки, нет совпадения в map — остаётся field.table, поэтому все
 * существующие конфиги работают как раньше.
 *
 * Значение в map — имя таблицы строкой либо объект { table: 'Имя' } на случай,
 * если понадобится возить рядом что-то ещё.
 *
 * Живёт отдельным файлом, потому что нужна двум редакторам сразу:
 * PVAutoComplete (форма, попап) и TanEditCell (инлайн-редактирование ячейки).
 */
export function resolveFieldTable(field, row) {
    if (!field) return ''
    const by = field.table_by
    if (by && by.field && row) {
        const key = row[by.field]
        const map = by.map || {}
        const hit = map[key] ?? map[String(key)]
        if (hit) return typeof hit === 'string' ? hit : hit.table
    }
    return field.table
}
