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
  window.addEventListener('error', (e) => {
    // Шум браузера, не ошибка приложения
    if (String(e.message || '').includes('ResizeObserver loop')) return
    pvtError('window.error', e.error || e.message, e.filename + ':' + e.lineno)
  })
  window.addEventListener('unhandledrejection', (e) => pvtError('unhandledrejection', e.reason))
  installScrollProbe()
}

// ─── Кто двигает прокрутку (20.11.2026: «таблица прыгает вверх») ─────────────
// Перехватываем всё, что может прокрутить страницу или таблицу, и пишем со стеком.
// Резкий скачок (> JUMP px за одно событие) помечается «ПРЫЖОК».
const JUMP = 150
const where = () => (new Error().stack || '').split(String.fromCharCode(10)).slice(3, 8).map(s => s.trim()).join(' | ')
const descr = (el) => el === window ? 'window' : (el?.tagName + '.' + String(el?.className || '').split(' ').slice(0, 3).join('.'))

const installScrollProbe = () => {
  if (!enabled()) return
  // 1. scrollTop = … у таблиц (.tan-scroll)
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')
  if (d && d.set) {
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set(v) {
        if (this.classList?.contains('tan-scroll') && Math.abs(v - d.get.call(this)) > JUMP) {
          pvtLog(`ПРЫЖОК таблицы: scrollTop ${Math.round(d.get.call(this))} → ${Math.round(v)} :: ${where()}`)
        }
        d.set.call(this, v)
      },
    })
  }
  // 2. Явная прокрутка окна и элементов
  for (const [obj, name] of [[window, 'scrollTo'], [window, 'scroll'], [window, 'scrollBy'], [Element.prototype, 'scrollTo'], [Element.prototype, 'scrollIntoView']]) {
    const orig = obj[name]
    if (typeof orig !== 'function') continue
    obj[name] = function (...a) {
      pvtLog(`прокрутка: ${descr(this)}.${name}(${JSON.stringify(a).slice(0, 80)}) :: ${where()}`)
      return orig.apply(this, a)
    }
  }
  // 3. focus() без preventScroll, который сдвинул страницу
  const focus = HTMLElement.prototype.focus
  HTMLElement.prototype.focus = function (o) {
    const y = window.scrollY
    const r = focus.call(this, o)
    if (window.scrollY !== y) pvtLog(`ПРЫЖОК страницы от focus(): ${y} → ${window.scrollY}, элемент ${descr(this)} :: ${where()}`)
    return r
  }
  // 4. Итог по событиям прокрутки: страница и любые .tan-scroll
  let winY = window.scrollY
  const tbl = new WeakMap()
  document.addEventListener('scroll', (e) => {
    const t = e.target
    if (t === document || t === document.documentElement || t === document.body) {
      if (Math.abs(window.scrollY - winY) > JUMP) pvtLog(`ПРЫЖОК страницы: ${Math.round(winY)} → ${Math.round(window.scrollY)}, фокус ${descr(document.activeElement)}`)
      winY = window.scrollY
    } else if (t?.classList?.contains('tan-scroll')) {
      const prev = tbl.get(t) ?? t.scrollTop
      if (Math.abs(t.scrollTop - prev) > 1500) pvtLog(`ПРЫЖОК таблицы (событие): ${Math.round(prev)} → ${Math.round(t.scrollTop)}`)
      tbl.set(t, t.scrollTop)
    }
  }, true)
}
