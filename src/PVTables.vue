<template>
  <!-- ── Mobile card list ────────────────────────────────────────────── -->
  <TanMobileList
    v-if="useMobileView"
    ref="mobileListRef"
    :table="table"
    :actions="actions"
    :filters="props.filters"
    :sorting="sorting"
    :scrollHeight="scrollHeight"
    :autoFitHeight="autoFitHeight"
    :scrollMode="mobileScrollMode"
    @get-response="emit('get-response', $event)"
    @refresh-table="emit('refresh-table', $event)"
    @switch-to-desktop="setForceDesktop(true)"
  />

  <!-- ── TanStack Table — единственный десктопный движок ───────────── -->
  <TanTable
    v-else
    ref="tanTableRef"
    :table="table"
    :actions="actions"
    :filters="props.filters"
    :sorting="sorting"
    :scrollHeight="scrollHeight"
    :autoFitHeight="autoFitHeight"
    :child="child"
    :embeddedInRow="embeddedInRow"
    :emptyRowsCount="emptyRowsCount"
    @get-response="emit('get-response', $event)"
    @refresh-table="emit('refresh-table', $event)"
    @rows-loaded="emit('rows-loaded', $event)"
  />

  <Toast/>
</template>

<script setup>
  import Toast from 'primevue/toast';
  import Tooltip from 'primevue/tooltip';
  import { ref, defineComponent, computed } from "vue";
  import TanTable from './components/TanTable.vue'
  import TanMobileList from './components/TanMobileList.vue'
  import { useMobileLayout } from './composables/useMobileLayout'
  import { useNotifications } from "./components/useNotifications";
  
  // DataTable (форк PrimeVue) выпилен 19.07.2026 вместе с PrimeVue-веткой шаблона.


  const props = defineProps({
    table: {
      type: String,
      required: true,
    },
    actions: {
      type: Object,
      default: {},
    },
    reload: {
      type: Boolean,
    },
    filters: {
      type: Object,
      default: {},
    },
    sorting: {
      type: Array,
      default: () => []
    },
    child:{
      type: Boolean, // Универсальный «вложенная таблица» — влияет на skip URL filters и mobile scroll
      default: false
    },
    embeddedInRow:{
      // Узкая семантика: таблица отрендерена ВНУТРИ row-expansion (subtables/subtabs).
      // Активирует scale-down ширин в TanTable (-120px). НЕ ставить для PVTabs-табов.
      type: Boolean,
      default: false
    },
    styleTable: {
      type: String,
      default: 'pro' // 'init' или 'pro'
    },
    scrollHeight: {
      type: String,
      default: '85vh'
    },
    autoFitHeight: {
      type: Boolean,
      default: false
    },
    emptyRowsCount: {
      type: Number,
      default: 0
    }
  });
  const emit = defineEmits(['get-response','refresh-table','rows-loaded'])



  const { notify } = useNotifications();

  // const handlePrintSuccess = (result) => {
  //   notify('success', { detail: 'Печать выполнена успешно' })
  // }

  // const handlePrintError = (error) => {
  //   notify('error', { detail: `Ошибка печати: ${error.message}` })
  // }





  // ── Движок таблицы ─────────────────────────────────────────────────
  // PrimeVue DataTable выпилен 19.07.2026 — на десктопе остался только TanStack,
  // выбирать больше нечего. Подчищаем ключ переключателя движка: у тех, кто
  // когда-то выбрал 'primevue', он иначе просто болтался бы мусором в localStorage.
  try { localStorage.removeItem(`pvtables-engine-${props.table}`) } catch {}
  // ──────────────────────────────────────────────────────────────────

  // ── Mobile layout ──────────────────────────────────────────────────
  const { useMobileView, setForceDesktop } = useMobileLayout()
  const mobileScrollMode = computed(() => (props.autoFitHeight || props.child) ? 'container' : 'window')
  // ──────────────────────────────────────────────────────────────────

  // Ссылки на дочерние таблицы. Обязательны: на них завязаны template-ref'ы
  // (ref="tanTableRef" / ref="mobileListRef") и весь defineExpose ниже.
  const tanTableRef  = ref()
  const mobileListRef = ref()
  
  
  const refresh = (from_parent,table) => {
    tanTableRef.value?.refresh(from_parent, table)
    if (!from_parent && (!table || table == props.table)) emit('refresh-table')
  };
  

  
  // Экспортируем методы для внешнего использования
  defineExpose({
    refresh,
    recalculateHeight: (...args) => tanTableRef.value?.recalculateHeight?.(...args),
    scrollToLast: () => useMobileView.value
      ? mobileListRef.value?.scrollToLast?.()
      : tanTableRef.value?.scrollToLast?.(),
    refreshAndScrollToLast: () => useMobileView.value
      ? mobileListRef.value?.refreshAndScrollToLast?.()
      : tanTableRef.value?.refreshAndScrollToLast?.(),
  });
</script>
