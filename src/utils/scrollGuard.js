// Пока открыто модальное окно, фон не должен прокручиваться.
//
// PrimeVue Dialog (modal) при открытии ставит на body класс p-overflow-hidden: полоса прокрутки
// страницы исчезает, ширина документа меняется (на Windows ~17px), таблицы перекладываются —
// и браузер сам сбрасывает их прокрутку в 0 (без всякого JS). При закрытии — то же в обратную
// сторону. Плюс фокус на кнопке окна может прокрутить страницу. Пользователь видит: «таблица
// прыгнула вверх» (office, 20.11.2026; e2e: gtsSnab/tests/e2e/zakup_scroll_jump.mjs SCROLLBARS=1).
//
// Под маской фон прокрутить нельзя, значит любое изменение прокрутки фона в это время —
// паразитное. Запоминаем прокрутку страницы и всех таблиц (.tan-scroll вне окон) на открытии
// и возвращаем её при каждом изменении, пока body заблокирован и ещё 400 мс после снятия
// блокировки (закрытие тоже перекладывает страницу).
import { pvtLog } from './pvtDebug'

const RELEASE_MS = 400
let active = null

const start = () => {
  const winX = window.scrollX, winY = window.scrollY
  const els = [...document.querySelectorAll('.tan-scroll')].filter(el => !el.closest('.p-dialog'))
  const saved = new Map(els.map(el => [el, { top: el.scrollTop, left: el.scrollLeft }]))

  const onEl = (e) => {
    const el = e.currentTarget, s = saved.get(el)
    if (!s || (el.scrollTop === s.top && el.scrollLeft === s.left)) return
    pvtLog(`окно открыто: таблица сдвинулась ${Math.round(s.top)} → ${Math.round(el.scrollTop)} — возвращаю`)
    el.scrollTop = s.top
    el.scrollLeft = s.left
  }
  const onWin = () => {
    if (window.scrollY === winY && window.scrollX === winX) return
    pvtLog(`окно открыто: страница сдвинулась ${winY} → ${window.scrollY} — возвращаю`)
    window.scrollTo(winX, winY)
  }
  els.forEach(el => el.addEventListener('scroll', onEl))
  window.addEventListener('scroll', onWin)
  // Фокус в окне сдвигает страницу синхронно — вернуть до отрисовки
  Promise.resolve().then(onWin)
  requestAnimationFrame(onWin)

  return () => {
    els.forEach(el => el.removeEventListener('scroll', onEl))
    window.removeEventListener('scroll', onWin)
  }
}

let timer = null
const watchBody = () => {
  const locked = document.body.classList.contains('p-overflow-hidden')
  if (locked) {
    clearTimeout(timer); timer = null
    if (!active) active = start()
  } else if (active && !timer) {
    timer = setTimeout(() => { timer = null; if (active) { active(); active = null } }, RELEASE_MS)
  }
}

let installed = false
// Вызвать из Dialog @show (до focus() PrimeVue) — запоминаем прокрутку ещё до перекладки.
export const guardScrollOnDialog = () => {
  if (typeof document === 'undefined') return
  if (!installed) {
    installed = true
    new MutationObserver(watchBody).observe(document.body, { attributes: true, attributeFilter: ['class'] })
  }
  if (!active) active = start()
  // Если body так и не заблокируют (немодальное окно) — снять охрану как обычно
  Promise.resolve().then(watchBody)
}
