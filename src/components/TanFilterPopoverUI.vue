<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import apiCtor from './api'

const props = defineProps({
  openFilterColId:   { type: String,  default: null },
  filterPopoverPos:  { type: Object,  default: () => ({ top: 0, left: 0 }) },
  colType:           { type: String,  default: 'text' },
  colMeta:           { type: Object,  default: null },  // full column definition
  columnLabel:       { type: String,  default: '' },
  // серверный фильтр
  serverFilter:      { type: Object,  default: null },  // { operator, constraints }
  matchModes:        { type: Array,   default: () => [] },
  matchModeLabels:   { type: Object,  default: () => ({}) },
  operatorLabels:    { type: Object,  default: () => ({}) },
  // select options (для select-колонок)
  selectOptions:     { type: Array,   default: () => [] },  // [{id, content}]
  // чеклист
  checklistAll:      { type: Array,   default: () => [] },  // [{value, label}]
  checklistChecked:  { type: Object,  default: null },      // Set
})

const emit = defineEmits([
  'apply-server',
  'clear-all',
  'close',
  'update:operator',
  'update:constraint-value',
  'update:constraint-mode',
  'add-constraint',
  'remove-constraint',
  'toggle-checklist',
  'toggle-checklist-all',
])

const firstInputRef = ref(null)

watch(() => props.openFilterColId, val => {
  if (val) nextTick(() => firstInputRef.value?.focus())
  else {
    // Закрытие — сбросить дропдаун
    acDropdownIdx.value = -1
    acDropdownOptions.value = []
    acDropdownOpen.value = false
  }
})

const allChecked = computed(() =>
  props.checklistChecked && props.checklistAll.length > 0 &&
  props.checklistChecked.size === props.checklistAll.length
)

const operatorOptions = computed(() =>
  Object.entries(props.operatorLabels).map(([value, label]) => ({ value, label }))
)

const isAcType = computed(() => props.colType === 'autocomplete')
const isSelectType = computed(() => props.colType === 'select')

// ── Autocomplete dropdown ──────────────────────────────────────────────────
const acDropdownOptions = ref([])
const acDropdownOpen    = ref(false)
const acDropdownIdx     = ref(-1)
const acActiveConstraintIdx = ref(0)
let   acDebounce        = null

const acApi = computed(() => {
  if (isAcType.value && props.colMeta?.table) return apiCtor(props.colMeta.table)
  return null
})

// Показать имя constraint (для отображения content вместо id)
const constraintDisplayTexts = ref({})  // idx → displayText

const onAcInput = (e, idx) => {
  const text = e.target.value
  // Сбрасываем display
  delete constraintDisplayTexts.value[idx]
  emit('update:constraint-value', { idx, value: text })
  acActiveConstraintIdx.value = idx
  acDropdownIdx.value = -1

  if (isSelectType.value) {
    // Фильтруем из selectOptions
    const q = text.trim().toLowerCase()
    if (!q) {
      acDropdownOptions.value = props.selectOptions
    } else {
      acDropdownOptions.value = props.selectOptions.filter(o =>
        String(o.content).toLowerCase().includes(q) || String(o.id) === q
      )
    }
    acDropdownOpen.value = acDropdownOptions.value.length > 0
    return
  }

  if (!acApi.value) return
  clearTimeout(acDebounce)
  const q = text.trim()
  if (!q) { acDropdownOpen.value = false; acDropdownOptions.value = []; return }
  acDebounce = setTimeout(async () => {
    try {
      const isNum = /^\d+$/.test(q)
      const baseParams = {
        parent: props.colMeta?.parent,
        ids: props.colMeta?.ids || '',
      }

      if (isNum) {
        // 2 параллельных запроса: id/show_id + текстовый поиск
        const idParams = props.colMeta?.show_id
          ? { ...baseParams, show_id: q, limit: 5, offset: 0 }
          : { ...baseParams, id: q, limit: 5, offset: 0 }
        const queryParams = { ...baseParams, query: q, limit: 20, offset: 0 }
        const [idRes, queryRes] = await Promise.all([
          acApi.value.autocomplete(idParams),
          acApi.value.autocomplete(queryParams),
        ])
        const idRows = idRes?.data?.rows ?? []
        const queryRows = queryRes?.data?.rows ?? []
        const idSet = new Set(idRows.map(o => String(o.id)))
        acDropdownOptions.value = [...idRows, ...queryRows.filter(o => !idSet.has(String(o.id)))]
      } else {
        const params = { ...baseParams, query: q, limit: 20, offset: 0 }
        const res = await acApi.value.autocomplete(params)
        acDropdownOptions.value = res?.data?.rows ?? []
      }
      acDropdownOpen.value = acDropdownOptions.value.length > 0
    } catch { acDropdownOptions.value = []; acDropdownOpen.value = false }
  }, 250)
}

const selectAcOption = (opt) => {
  const idx = acActiveConstraintIdx.value
  emit('update:constraint-value', { idx, value: String(opt.id) })
  constraintDisplayTexts.value[idx] = opt.content
  acDropdownOpen.value = false
  acDropdownOptions.value = []
  acDropdownIdx.value = -1
}

const onAcFocus = (idx) => {
  acActiveConstraintIdx.value = idx
  if (isSelectType.value && acDropdownOptions.value.length === 0) {
    acDropdownOptions.value = props.selectOptions
    acDropdownOpen.value = props.selectOptions.length > 0
  }
}

const onAcKeydown = (e, idx) => {
  if (!acDropdownOpen.value) return
  if (e.key === 'ArrowDown') {
    acDropdownIdx.value = Math.min(acDropdownIdx.value + 1, acDropdownOptions.value.length - 1)
    e.preventDefault()
  } else if (e.key === 'ArrowUp') {
    acDropdownIdx.value = Math.max(acDropdownIdx.value - 1, 0)
    e.preventDefault()
  } else if (e.key === 'Enter' && acDropdownIdx.value >= 0) {
    selectAcOption(acDropdownOptions.value[acDropdownIdx.value])
    e.preventDefault()
    e.stopPropagation()
  }
}

const getConstraintDisplay = (c, idx) => {
  if (constraintDisplayTexts.value[idx]) return constraintDisplayTexts.value[idx]
  return c.value
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="openFilterColId"
      class="tan-filter-popover"
      :style="{ top: filterPopoverPos.top + 'px', left: filterPopoverPos.left + 'px' }"
      @keydown.esc="emit('close')"
    >
      <div class="tan-filter-popover-inner">

        <!-- Заголовок -->
        <div class="tan-filter-popover-label">
          <i class="pi pi-filter" />
          {{ columnLabel || openFilterColId }}
        </div>

        <!-- ═══ Секция 1: Серверный фильтр ═══ -->
        <div class="tan-filter-section">
          <div class="tan-filter-section-title">Фильтр</div>

          <!-- Оператор -->
          <select
            v-if="serverFilter && serverFilter.constraints.length > 1"
            class="tan-filter-select"
            :value="serverFilter?.operator"
            @change="emit('update:operator', $event.target.value)"
          >
            <option v-for="op in operatorOptions" :key="op.value" :value="op.value">{{ op.label }}</option>
          </select>

          <!-- Constraints -->
          <div v-if="serverFilter" class="tan-filter-constraints">
            <div v-for="(c, idx) in serverFilter.constraints" :key="idx" class="tan-filter-constraint-row">
              <select
                class="tan-filter-select tan-filter-mode-select"
                :value="c.matchMode"
                @change="emit('update:constraint-mode', { idx, value: $event.target.value })"
              >
                <option v-for="mm in matchModes" :key="mm" :value="mm">{{ matchModeLabels[mm] || mm }}</option>
              </select>

              <!-- boolean -->
              <template v-if="colType === 'boolean'">
                <select
                  class="tan-filter-select"
                  :value="c.value"
                  @change="emit('update:constraint-value', { idx, value: $event.target.value })"
                >
                  <option value="">—</option>
                  <option value="1">Да</option>
                  <option value="0">Нет</option>
                </select>
              </template>

              <!-- autocomplete / select — инпут с дропдауном -->
              <template v-else-if="isAcType || isSelectType">
                <div class="tan-filter-ac-wrap">
                  <input
                    :ref="idx === 0 ? (el) => { firstInputRef = el } : undefined"
                    class="tan-filter-popover-input"
                    type="text"
                    :value="getConstraintDisplay(c, idx)"
                    placeholder="Поиск…"
                    @input="onAcInput($event, idx)"
                    @focus="onAcFocus(idx)"
                    @keydown="onAcKeydown($event, idx)"
                    @keydown.enter.exact="!acDropdownOpen && emit('apply-server')"
                  />
                  <div
                    v-if="acDropdownOpen && acActiveConstraintIdx === idx"
                    class="tan-filter-ac-dropdown"
                  >
                    <div
                      v-for="(opt, i) in acDropdownOptions"
                      :key="opt.id"
                      class="tan-option-item"
                      :class="{ 'tan-option-active': i === acDropdownIdx }"
                      @mousedown.prevent="selectAcOption(opt)"
                    >
                      <template v-if="colMeta && !colMeta.hide_id">
                        <span class="tan-option-id">{{ (colMeta.show_id && opt[colMeta.show_id] > 0) ? opt[colMeta.show_id] : opt.id }}</span>
                      </template>
                      {{ opt.content }}
                    </div>
                    <div v-if="acDropdownOptions.length === 0" class="tan-option-empty">Не найдено</div>
                  </div>
                </div>
              </template>

              <!-- остальные типы — обычный инпут -->
              <template v-else>
                <input
                  :ref="idx === 0 ? (el) => { firstInputRef = el } : undefined"
                  class="tan-filter-popover-input"
                  :type="colType === 'date' ? 'date' : 'text'"
                  :value="c.value"
                  placeholder="Значение…"
                  @input="emit('update:constraint-value', { idx, value: $event.target.value })"
                  @keydown.enter="emit('apply-server')"
                />
              </template>

              <button
                v-if="serverFilter.constraints.length > 1"
                class="tan-filter-remove-btn"
                @click="emit('remove-constraint', idx)"
                title="Удалить"
              ><i class="pi pi-times" /></button>
            </div>
          </div>

          <!-- Добавить правило -->
          <button class="tan-filter-add-rule" @click="emit('add-constraint')">
            <i class="pi pi-plus" /> Добавить правило
          </button>

          <!-- Кнопки -->
          <div class="tan-filter-popover-actions">
            <button class="tan-filter-action-btn tan-filter-action-clear" @click="emit('clear-all')">
              <i class="pi pi-times" /> Сбросить
            </button>
            <button class="tan-filter-action-btn tan-filter-action-apply" @click="emit('apply-server')">
              <i class="pi pi-check" /> Применить
            </button>
          </div>
        </div>

        <!-- ═══ Секция 2: Чеклист значений ═══ -->
        <div v-if="checklistAll.length > 0" class="tan-filter-section">
          <div class="tan-filter-section-title">Значения</div>

          <label class="tan-filter-checklist-item tan-filter-checklist-all">
            <input
              type="checkbox"
              :checked="allChecked"
              :indeterminate="checklistChecked && checklistChecked.size > 0 && !allChecked"
              @change="emit('toggle-checklist-all')"
            />
            <span>Выбрать все</span>
          </label>

          <div class="tan-filter-checklist">
            <label
              v-for="item in checklistAll"
              :key="item.value"
              class="tan-filter-checklist-item"
            >
              <input
                type="checkbox"
                :checked="checklistChecked?.has(item.value)"
                @change="emit('toggle-checklist', item.value)"
              />
              <span>{{ item.label }}</span>
            </label>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
