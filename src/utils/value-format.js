/**
 * Значение для показа в текстовом поле/ячейке.
 *
 * Зачем: pdoTools разворачивает JSON-поля в объект, и такое значение в поле
 * превращалось в «[object Object]» — данные были не видны ни в таблице, ни в форме.
 * Показываем читаемый JSON с отступами и переносами строк.
 *
 * @param {*} v
 * @returns {string}
 */
export const toDisplayText = (v) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'object') {
        try {
            return JSON.stringify(v, null, 2)
        } catch (e) {
            // Циклические ссылки и прочая экзотика — лучше хоть что-то, чем [object Object]
            return String(v)
        }
    }

    return String(v)
}

/**
 * Обратное преобразование при сохранении: строку, которая на самом деле JSON,
 * возвращаем объектом — иначе поле уедет на сервер строкой и структура потеряется.
 * Не-JSON остаётся строкой как есть.
 *
 * @param {string} text
 * @returns {*}
 */
export const fromDisplayText = (text) => {
    if (typeof text !== 'string') return text
    const t = text.trim()
    if (t === '' || (t[0] !== '{' && t[0] !== '[')) return text
    try {
        return JSON.parse(t)
    } catch (e) {
        return text
    }
}
