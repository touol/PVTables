import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const BREAKPOINT = 768
const LS_KEY = 'pvtables-force-desktop'

const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < BREAKPOINT)
const forceDesktop = ref(typeof window !== 'undefined' && localStorage.getItem(LS_KEY) === '1')

let _listenerAttached = false

const onResize = () => { isMobile.value = window.innerWidth < BREAKPOINT }

export function useMobileLayout() {
  onMounted(() => {
    if (!_listenerAttached) {
      window.addEventListener('resize', onResize)
      _listenerAttached = true
    }
  })

  onBeforeUnmount(() => {
    // intentionally keep listener alive — shared singleton
  })

  const useMobileView = computed(() => isMobile.value && !forceDesktop.value)

  const setForceDesktop = (val) => {
    forceDesktop.value = !!val
    try { localStorage.setItem(LS_KEY, val ? '1' : '0') } catch {}
  }

  return { isMobile, forceDesktop, useMobileView, setForceDesktop }
}
