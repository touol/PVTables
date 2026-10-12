<template>
  <!-- Закрыт: кнопка-запускатель.
       Её можно выключить пропом launcher, но ТОЛЬКО если хост сам управляет
       открытием через v-model:open. Иначе чат после закрытия стал бы
       недостижим — открыть его было бы нечем. -->
  <button
    v-if="showLauncher"
    class="gtsai-dock-launch"
    :class="dock === 'inline' ? 'gtsai-dock-launch--flow' : 'gtsai-dock-launch--corner'"
    title="Чат ИИ"
    @click="setOpen(true)"
  >🤖<span class="gtsai-dock-launch-text">Чат ИИ</span></button>

  <div
    v-else-if="isOpen"
    class="gtsai-dock"
    :class="['gtsai-dock--' + dock, { 'gtsai-dock--fill': fill }]"
    :style="dockStyle"
    ref="root"
  >
    <!-- Край для растягивания. У встроенного режима его нет: там размер
         задаёт верстка хоста. -->
    <div
      v-if="dock !== 'inline'"
      class="gtsai-dock-grip"
      :class="'gtsai-dock-grip--' + dock"
      @mousedown.prevent="startResize"
    ></div>

    <!-- Когда чат сам по себе страница, эта полоса не нужна: переносить его
         в бок некуда (страница опустеет), закрывать — тоже. -->
    <div v-if="!fill" class="gtsai-dock-bar">
      <span class="gtsai-dock-place">Чат ИИ</span>
      <span class="gtsai-dock-spacer"></span>
      <button
        v-for="p in places"
        :key="p.id"
        class="gtsai-dock-btn"
        :class="{ 'gtsai-dock-btn--on': dock === p.id }"
        :title="p.title"
        @click="setDock(p.id)"
      >{{ p.icon }}</button>
      <button class="gtsai-dock-btn" title="Закрыть" @click="setOpen(false)">✕</button>
    </div>

    <div class="gtsai-dock-body">
      <GtsAIChat
        :setting="setting"
        :title="title"
        :page="page"
        :params="params"
        :echo="echo"
        :heading="!fill"
        @changed="(e) => emit('changed', e)"
      />
    </div>
  </div>
</template>

<script setup>
/**
 * Размещение чата ИИ на странице: слева, справа, сверху, снизу или встроенно.
 *
 * Почему не Drawer (хотя на странице расчёта он уже используется для
 * «Избранного»): чат — не разовый выбор из списка, с ним работают, глядя в
 * таблицу. Выезжающая панель закрывает те самые строки, о которых спрашивают.
 * Поэтому панель закреплённая и **отодвигает** контент страницы, а не лежит
 * поверх него.
 *
 * Место выбирает пользователь, и выбор помнится: это предпочтение рабочего
 * места, а не настройка системы, поэтому живёт в localStorage этого браузера.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue'
import GtsAIChat from './GtsAIChat.vue'

const props = defineProps({
  setting: { type: String, default: 'default' },
  title: { type: String, default: '' },
  page: { type: String, default: '' },
  params: { type: Object, default: null },
  echo: { type: Boolean, default: false },
  /** Где показать в первый раз: inline | left | right | top | bottom. */
  defaultDock: { type: String, default: 'right' },
  /** Открыт ли при первом заходе. */
  defaultOpen: { type: Boolean, default: false },
  /** Своя кнопка у хоста — выключить встроенный запускатель. */
  launcher: { type: Boolean, default: true },
  /** Ключ памяти; по умолчанию свой на каждое имя настроек. */
  storageKey: { type: String, default: '' },
  /**
   * Селектор области, внутри которой живёт панель (например '.content').
   * Пусто — панель занимает край окна.
   *
   * Нужно, чтобы чат не выпихивал шапку приложения и боковое меню: он
   * инструмент рабочей области, а не всей страницы.
   */
  boundary: { type: String, default: '' },
  /**
   * Чат — содержимое страницы, а не панель поверх неё.
   *
   * Тогда у него нет ни полосы с переносом (переносить некуда — страница
   * опустеет), ни своего заголовка (его уже напечатал шаблон сайта), а по
   * высоте он занимает весь экран: иначе под ним остаётся пустое поле, а
   * лента сжимается в полоску.
   */
  fill: { type: Boolean, default: false },
})

// Событие об изменении данных только пробрасываем наружу: решает, что
// перечитывать, тот, кто чат встроил.
const emit = defineEmits(['changed'])

const open = defineModel('open', { type: Boolean, default: false })

/**
 * Управляет ли открытием хост (есть ли v-model:open).
 *
 * ⚠️ Проверять это по значению модели нельзя: Vue приводит ОТСУТСТВУЮЩИЙ
 * Boolean-проп к false, поэтому «хост не передал open» и «хост передал false»
 * выглядят одинаково. На этом виджет один раз исчез целиком: сам он считал,
 * что открытием распоряжается хост, а хост ничего не передавал.
 * Поэтому смотрим на то, что реально пришло в vnode.
 */
const root = ref(null)
const inst = getCurrentInstance()
const controlled = !!(inst && inst.vnode && inst.vnode.props &&
  ('open' in inst.vnode.props || 'onUpdate:open' in inst.vnode.props))

const places = [
  { id: 'left', icon: '◧', title: 'Слева' },
  { id: 'top', icon: '◰', title: 'Сверху' },
  { id: 'bottom', icon: '◱', title: 'Снизу' },
  { id: 'right', icon: '◨', title: 'Справа' },
  { id: 'inline', icon: '▭', title: 'В потоке страницы' },
]

const SIDE_DEFAULT = 380
const EDGE_DEFAULT = 260

const dock = ref(props.defaultDock)
const size = ref(SIDE_DEFAULT)
const openLocal = ref(props.defaultOpen)

// Хост может управлять открытием сам (v-model:open) — тогда слушаемся его.
const isOpen = computed(() => (controlled ? !!open.value : openLocal.value))
const setOpen = (v) => {
  openLocal.value = v
  if (controlled) open.value = v
  remember()
}

// Запускатель нужен всегда, когда открытием не управляет хост: пропом launcher
// его гасят только вместе с v-model:open, иначе закрытый чат уже не открыть.
const showLauncher = computed(() => !isOpen.value && (props.launcher || !controlled))

const vertical = computed(() => dock.value === 'top' || dock.value === 'bottom')

/** Прямоугольник области (или null, если панель на краю окна). */
const box = ref(null)
let boundaryEl = null
let ro = null

/**
 * Верхняя граница: если сверху висит прилипшая или закреплённая полоса
 * (шапка приложения), панель должна начинаться под ней, а не уезжать под неё.
 *
 * Определяем по факту — что лежит в самой верхней точке области, — чтобы не
 * зашивать в компонент знание про чужую вёрстку.
 */
const topGuard = (left, right) => {
  const x = Math.round((left + right) / 2)
  let el = document.elementFromPoint(x, 2)
  while (el && el !== document.body) {
    if (el.closest('.gtsai-dock')) return 0
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if ((cs.position === 'fixed' || cs.position === 'sticky') && r.top <= 2 && r.bottom > 2) return r.bottom
    el = el.parentElement
  }
  return 0
}

/**
 * То же, что topGuard, но снизу: на странице админки внизу висит закреплённая
 * полоса AdminPanel, и чат во весь экран прятал под ней поле ввода.
 */
const bottomGuard = (left, right) => {
  const x = Math.round((left + right) / 2)
  const y = window.innerHeight - 2
  let el = document.elementFromPoint(x, y)
  while (el && el !== document.body) {
    if (el.closest('.gtsai-dock')) return 0
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if ((cs.position === 'fixed' || cs.position === 'sticky') && r.bottom >= y && r.top < y) {
      return window.innerHeight - r.top
    }
    el = el.parentElement
  }
  return 0
}

const measure = () => {
  if (!props.boundary) { box.value = null; return }
  boundaryEl = document.querySelector(props.boundary)
  if (!boundaryEl) { box.value = null; return }

  const r = boundaryEl.getBoundingClientRect()

  // ⚠️ Панель закреплённая, поэтому считать надо по ВИДИМОЙ части области.
  // Высота самой области — это высота всего содержимого (таблица на 169 строк
  // длиннее экрана), и панель по ней уезжала низом за край окна вместе с
  // полем ввода.
  const left = Math.max(r.left, 0)
  const right = Math.min(r.right, window.innerWidth)
  const top = Math.max(r.top, topGuard(left, right))
  const bottom = Math.min(r.bottom, window.innerHeight)

  box.value = {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}

/** Сколько пикселей экрана чат отдаёт: что над ним и что закреплено снизу. */
const fillTop = ref(0)
const fillBottom = ref(0)

const dockStyle = computed(() => {
  if (dock.value === 'inline') {
    // Высоту считаем от фактического положения: сколько над чатом шапки
    // сайта и заголовка, столько и вычитаем. Процентами это не берётся —
    // у родителей высота не задана.
    if (!props.fill) return {}
    const gone = Math.round(fillTop.value + fillBottom.value)
    return { height: 'calc(100dvh - ' + gone + 'px - 1rem)' }
  }
  // Без области — край окна, как раньше: место задают классы.
  if (!box.value) return vertical.value ? { height: size.value + 'px' } : { width: size.value + 'px' }

  // С областью место считаем сами, в пикселях от её краёв.
  const b = box.value
  const px = (v) => Math.round(v) + 'px'
  if (dock.value === 'right')  return { top: px(b.top), left: px(b.right - size.value), width: px(size.value), height: px(b.height) }
  if (dock.value === 'left')   return { top: px(b.top), left: px(b.left), width: px(size.value), height: px(b.height) }
  if (dock.value === 'top')    return { top: px(b.top), left: px(b.left), width: px(b.width), height: px(size.value) }
  return { top: px(b.bottom - size.value), left: px(b.left), width: px(b.width), height: px(size.value) }
})

/* ------------------------------------------------------------------ *
 *  Память выбора
 * ------------------------------------------------------------------ */

const key = computed(() => props.storageKey || 'gtsai_dock_' + props.setting)

const remember = () => {
  // localStorage бывает недоступен (приватное окно, запрет на данные сайта) —
  // в этом случае просто не помним, а не падаем.
  try {
    localStorage.setItem(key.value, JSON.stringify({
      dock: dock.value,
      size: size.value,
      open: isOpen.value,
    }))
  } catch (e) { /* не помним — не беда */ }
}

const recall = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(key.value) || 'null')
    if (!saved) return
    if (places.some((p) => p.id === saved.dock)) dock.value = saved.dock
    if (Number.isFinite(saved.size)) size.value = clampSize(saved.size)
    if (typeof saved.open === 'boolean' && !controlled) openLocal.value = saved.open
  } catch (e) { /* ничего не помним — берём значения по умолчанию */ }
}

const setDock = (id) => {
  dock.value = id
  // Размер у боковой панели и у полосы сверху — разные величины, поэтому при
  // смене стороны берём разумный по умолчанию, а не тащим прежние пиксели.
  size.value = (id === 'top' || id === 'bottom') ? EDGE_DEFAULT : SIDE_DEFAULT
  remember()
}

/* ------------------------------------------------------------------ *
 *  Отодвигание страницы
 * ------------------------------------------------------------------ */

const PADS = { left: 'paddingLeft', right: 'paddingRight', top: 'paddingTop', bottom: 'paddingBottom' }
let appliedPad = ''

// Панель закреплённая, поэтому сама по себе легла бы поверх содержимого.
// Отступ даём ОБЛАСТИ (если она задана), а не всему документу: иначе чат
// выпихивает шапку приложения и боковое меню, хотя они к нему отношения не
// имеют.
let padEl = null

const applyPad = () => {
  clearPad()
  if (!isOpen.value || dock.value === 'inline') return
  measure()
  padEl = (props.boundary && document.querySelector(props.boundary)) || document.body
  appliedPad = PADS[dock.value]
  padEl.style[appliedPad] = size.value + 'px'
  // Отступ меняет размеры области — пересчитываем место панели по факту.
  requestAnimationFrame(measure)
}

const clearPad = () => {
  if (!appliedPad || !padEl) return
  padEl.style[appliedPad] = ''
  appliedPad = ''
  padEl = null
}

watch([isOpen, dock, size], applyPad)

/* ------------------------------------------------------------------ *
 *  Растягивание
 * ------------------------------------------------------------------ */

const clampSize = (v) => {
  const max = vertical.value ? window.innerHeight * 0.8 : window.innerWidth * 0.8
  return Math.max(220, Math.min(Math.round(v), Math.round(max)))
}

let resizing = null

const startResize = (e) => {
  resizing = { x: e.clientX, y: e.clientY, start: size.value }
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
  // Пока тянем, выделение текста только мешает.
  document.body.style.userSelect = 'none'
}

const onResize = (e) => {
  if (!resizing) return
  const dx = e.clientX - resizing.x
  const dy = e.clientY - resizing.y
  let next = resizing.start
  if (dock.value === 'right') next = resizing.start - dx
  else if (dock.value === 'left') next = resizing.start + dx
  else if (dock.value === 'bottom') next = resizing.start - dy
  else if (dock.value === 'top') next = resizing.start + dy
  size.value = clampSize(next)
}

const stopResize = () => {
  resizing = null
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
  document.body.style.userSelect = ''
  remember()
}

// Область двигается: прокрутка, изменение окна, свёрнутое меню. Панель
// должна ехать за ней, иначе повиснет посреди экрана.
const measureFill = () => {
  if (!props.fill || dock.value !== 'inline' || !root.value) return
  const r = root.value.getBoundingClientRect()
  // Верх берём относительно окна: страница с чатом во весь экран не прокручивается.
  fillTop.value = Math.max(0, r.top)
  fillBottom.value = bottomGuard(Math.max(r.left, 0), Math.min(r.right, window.innerWidth))
}

const follow = () => {
  if (!isOpen.value) return
  if (dock.value === 'inline') measureFill()
  else measure()
}

onMounted(() => {
  recall()
  applyPad()
  measure()
  measureFill()
  window.addEventListener('resize', follow)
  window.addEventListener('scroll', follow, true)
  if (props.boundary && window.ResizeObserver) {
    const el = document.querySelector(props.boundary)
    if (el) {
      ro = new ResizeObserver(follow)
      ro.observe(el)
    }
  }
})

onBeforeUnmount(() => {
  clearPad()
  stopResize()
  window.removeEventListener('resize', follow)
  window.removeEventListener('scroll', follow, true)
  if (ro) { ro.disconnect(); ro = null }
})

defineExpose({ setOpen, setDock })
</script>

<style scoped>
/* Цвет только из токенов темы. */
.gtsai-dock {
  position: fixed;
  z-index: var(--gts-z-sticky);
  display: flex;
  flex-direction: column;
  background: var(--gts-surface);
  color: var(--gts-ink);
  box-shadow: var(--gts-shadow-l);
}
.gtsai-dock--right { top: 0; right: 0; height: 100vh; border-left: 1px solid var(--gts-line-strong); }
.gtsai-dock--left { top: 0; left: 0; height: 100vh; border-right: 1px solid var(--gts-line-strong); }
.gtsai-dock--top { top: 0; left: 0; width: 100vw; border-bottom: 1px solid var(--gts-line-strong); }
.gtsai-dock--bottom { bottom: 0; left: 0; width: 100vw; border-top: 1px solid var(--gts-line-strong); }
/* Встроенный режим: обычный блок в потоке страницы, без фиксации. */
.gtsai-dock--inline {
  position: static;
  height: 100%;
  min-height: 24rem;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--gts-line);
  border-radius: var(--gts-radius);
  box-shadow: none;
}

/* Чат как страница: высоту даёт dockStyle, тело растягивается под неё. */
.gtsai-dock--fill { min-height: 20rem; }
.gtsai-dock--fill .gtsai-dock-body { flex: 1 1 auto; min-height: 0; }

.gtsai-dock-bar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.375rem;
  border-bottom: 1px solid var(--gts-line);
  background: var(--gts-surface-2);
}
.gtsai-dock-place { color: var(--gts-ink-3); font-size: var(--gts-size-sm); padding-left: 0.25rem; }
.gtsai-dock-spacer { flex: 1; }
.gtsai-dock-btn {
  width: 1.75rem;
  height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--gts-radius-s);
  background: transparent;
  color: var(--gts-ink-2);
  cursor: pointer;
  font-size: var(--gts-size-sm);
  line-height: 1;
}
.gtsai-dock-btn:hover { background: var(--gts-surface-3); color: var(--gts-ink); }
.gtsai-dock-btn--on {
  background: var(--gts-accent-soft);
  border-color: var(--gts-accent);
  color: var(--gts-accent);
}

/* ⚠️ Тело — само флекс-контейнер, а чат внутри тянется флексом, а НЕ
   процентом высоты. У встроенной панели высота задана `min-height`, при этом
   `height` остаётся `auto`; проценты относительно auto-высоты не разрешаются,
   и чат оставался по содержимому — поле ввода повисало посередине, а под ним
   была пустота (видно было в админке gtsAI). */
.gtsai-dock-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
/* Чат внутри занимает всю панель; своей рамки ему здесь не надо. */
.gtsai-dock-body :deep(.gtsai) {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
  border: 0;
  border-radius: 0;
}

.gtsai-dock-grip {
  position: absolute;
  z-index: 1;
}
.gtsai-dock-grip--right { top: 0; left: 0; width: 4px; height: 100%; cursor: ew-resize; }
.gtsai-dock-grip--left { top: 0; right: 0; width: 4px; height: 100%; cursor: ew-resize; }
.gtsai-dock-grip--top { bottom: 0; left: 0; height: 4px; width: 100%; cursor: ns-resize; }
.gtsai-dock-grip--bottom { top: 0; left: 0; height: 4px; width: 100%; cursor: ns-resize; }
.gtsai-dock-grip:hover { background: var(--gts-accent-soft); }

.gtsai-dock-launch {
  position: fixed;
  bottom: 1.25rem;
  z-index: var(--gts-z-sticky);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: var(--gts-control-h);
  padding: 0 0.75rem;
  border: 1px solid var(--gts-line-strong);
  border-radius: var(--gts-radius-l);
  background: var(--gts-surface);
  color: var(--gts-ink);
  cursor: pointer;
  box-shadow: var(--gts-shadow);
}
/* В потоке страницы (dock: inline) закреплённая кнопка в углу выглядела бы
   случайной: ставим обычную кнопку там, где стоял чат. */
.gtsai-dock-launch--flow { position: static; bottom: auto; box-shadow: none; }
/* Угол один и тот же при любом доке: кнопка, которая переезжает вслед за
   панелью, каждый раз ищется заново. */
.gtsai-dock-launch--corner { right: 1.25rem; }
.gtsai-dock-launch:hover { background: var(--gts-surface-2); }
.gtsai-dock-launch-text { font-size: var(--gts-size-sm); }
</style>
