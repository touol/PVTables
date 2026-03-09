<script setup>
const props = defineProps({
  first:           { type: Number, default: 0 },
  currentPageSize: { type: Number, default: 10 },
  totalRecords:    { type: Number, default: 0 },
  currentPage:     { type: Number, default: 1 },
  totalPages:      { type: Number, default: 1 },
  columnFilters:   { type: Array,  default: () => [] },
  rowSelection:    { type: Object, default: () => ({}) },
})

const emit = defineEmits([
  'go-first',
  'go-prev',
  'go-next',
  'go-last',
  'rows-per-page-change',  // event (native select change event)
  'clear-col-filter',      // (columnId)
])

const selectedCount = () => Object.values(props.rowSelection).filter(Boolean).length
</script>

<template>
  <div class="tan-paginator">
    <div class="tan-pag-rpp">
      <span class="tan-pag-rpp-label">Строк:</span>
      <select class="tan-pag-rpp-select"
        :value="currentPageSize"
        @change="emit('rows-per-page-change', $event)"
      >
        <option v-for="opt in [10, 30, 60, 100, 1000]" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    </div>

    <div class="tan-pag-nav">
      <button class="tan-pag-btn" @click="emit('go-first')"
        :disabled="first === 0" title="Первая">
        <i class="pi pi-angle-double-left" />
      </button>
      <button class="tan-pag-btn" @click="emit('go-prev')"
        :disabled="first === 0" title="Предыдущая">
        <i class="pi pi-angle-left" />
      </button>
      <span class="tan-pag-info">
        {{ first + 1 }}–{{ Math.min(first + currentPageSize, totalRecords) }} из {{ totalRecords }}
      </span>
      <button class="tan-pag-btn" @click="emit('go-next')"
        :disabled="first + currentPageSize >= totalRecords" title="Следующая">
        <i class="pi pi-angle-right" />
      </button>
      <button class="tan-pag-btn" @click="emit('go-last')"
        :disabled="currentPage >= totalPages" title="Последняя">
        <i class="pi pi-angle-double-right" />
      </button>
    </div>

    <div v-if="columnFilters.length > 0" class="tan-pag-filters">
      <span
        v-for="f in columnFilters" :key="f.id"
        class="tan-footer-filter-chip"
        @click="emit('clear-col-filter', f.id)"
        title="Сбросить фильтр"
      >{{ f.id }}: {{ f.value }} ×</span>
    </div>

    <div class="tan-pag-right">
      <span v-if="selectedCount() > 0" class="tan-pag-selected">
        Выбрано: {{ selectedCount() }}
      </span>
      <span class="tan-pag-hint">TanStack ⚡</span>
    </div>
  </div>
</template>
