// Трассировка действий PVTables в консоль: клик по кнопке строки → обработчик → форма →
// запрос → ответ. Всё с префиксом [PVT] — в консоли фильтруется по «PVT».
// Временная отладка (20.11.2026): на office у одной строки молча не работают все действия.
// Выключить без пересборки: localStorage.pvtDebug = '0'.

const enabled = () => {
  try { return localStorage.getItem('pvtDebug') !== '0' } catch (e) { return true }
}

export const pvtLog = (...args) => {
  if (enabled()) console.log('[PVT]', ...args)
}

export const pvtError = (where, error, ...args) => {
  console.error('[PVT] ОШИБКА в ' + where + ':', error, ...args)
}

// Глобально: упавшие промисы и ошибки вне Vue тоже пишем с меткой
let installed = false
export const pvtInstallGlobal = () => {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (e) => pvtError('window.error', e.error || e.message, e.filename + ':' + e.lineno))
  window.addEventListener('unhandledrejection', (e) => pvtError('unhandledrejection', e.reason))
}
