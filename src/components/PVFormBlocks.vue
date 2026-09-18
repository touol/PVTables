<template>
  <!-- Блок = смысловая группа полей карточки («Основное», «Размеры»).
       В ряд ставятся именно блоки: так устроен мокап отдела кадров, и так
       широкий экран заполняется без пустой половины справа. -->
  <div class="pvform-blocks" :data-cols="clampCols(blockCols)">
    <div
      v-for="(block, bi) in blocks"
      :key="block.key || bi"
      class="pvform-block"
      :class="{ 'pvform-block-spaced': blocks.length > 1 }"
    >
      <div v-if="block.label" class="pvform-block-title">{{ block.label }}</div>
      <div class="pvform-grid" :class="{ 'pvform-inline': inline && !(block.cols > 1) }" :data-cols="clampCols(block.cols)">
        <div
          v-for="col of block.fields"
          :key="col.field"
          class="pvform-field"
          :class="{ 'pvform-field-top': labelPosition === 'top' }"
          :style="fieldStyle(col, block)"
        >
          <label :for="col.field" class="pvform-label font-semibold">
            {{ col.label }}
            <span v-if="isFieldRequired(col)" class="text-red-500 ml-1">*</span>
          </label>
          <div class="pvform-control" :style="{ maxWidth: fieldWidth }">
            <div :class="{ 'p-invalid': isFieldInvalid(col) }">
              <EditField
                :field="col"
                v-model="model[col.field]"
                :data="model"
                :use_data="true"
                :autocompleteSettings="autocompleteSettings[col.field]"
                :selectSettings="selectSettings[col.field]"
                @set-value="$emit('set-value')"
              />
            </div>
            <small v-if="col.desc" class="block mt-1 text-gray-600">{{ col.desc }}</small>
            <small v-if="isFieldInvalid(col)" class="block mt-1 text-red-500">Поле обязательно для заполнения</small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import EditField from "./EditField.vue";

export default {
  name: 'PVFormBlocks',
  components: { EditField },
  props: {
    // [{ key, label, cols, fields: [колонка, ...] }]
    blocks: { type: Array, default: () => [] },
    // Модель правим по ссылке — как это делал PVForm до выделения блоков
    model: { type: Object, default: () => ({}) },
    autocompleteSettings: { type: Object, default: () => ({}) },
    selectSettings: { type: Object, default: () => ({}) },
    fieldWidth: { type: String, default: '24rem' },
    labelPosition: { type: String, default: 'left' },
    blockCols: { type: Number, default: 1 },
    inline: { type: Boolean, default: false },
  },
  emits: ['set-value'],
  methods: {
    // Колонки ступенями в CSS: узкий экран сам сводит их к одной, без JS
    clampCols(n) {
      const cols = Number(n) || 1
      return String(Math.min(Math.max(cols, 1), 4))
    },
    fieldStyle(col, block) {
      const cols = Number(block.cols) || 1
      const span = Number(col.col_span) || 1
      if (cols < 2 || span < 2) return null
      return { gridColumn: `span ${Math.min(span, cols)}` }
    },
    isFieldRequired(col) {
      const required = col.required
      const needed = col.needed
      return (required === true || required === 1 || required === '1') ||
             (needed === true || needed === 1 || needed === '1')
    },
    isFieldInvalid(col) {
      if (!this.isFieldRequired(col)) return false
      const value = this.model[col.field]
      if (value === null || value === undefined || value === '' || value === 0) return true
      if (typeof value === 'string' && value.trim() === '') return true
      return false
    },
  },
}
</script>

<style>
  /* Считаем ширину формы, а не окна: форма живёт и в панели дерева, и в модалке */
  .pvform { container-type: inline-size; }

  .pvform-blocks,
  .pvform-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  .pvform-blocks { column-gap: 2.5rem; }
  .pvform-grid   { column-gap: 1.5rem; }

  .pvform-blocks[data-cols="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pvform-blocks[data-cols="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pvform-blocks[data-cols="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .pvform-grid[data-cols="2"]   { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pvform-grid[data-cols="3"]   { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pvform-grid[data-cols="4"]   { grid-template-columns: repeat(4, minmax(0, 1fr)); }

  .pvform-block-spaced { margin-bottom: 1.5rem; }
  .pvform-block-title {
    font-weight: 600;
    margin-bottom: 0.75rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--p-content-border-color, #e5e7eb);
  }

  .pvform-field {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  /* 6rem обрезало «Пользователь» — длинному слову нужно место или перенос */
  .pvform-label { width: 7rem; padding-top: 0.5rem; overflow-wrap: anywhere; }
  .pvform-control { flex: 1 1 0%; min-width: 0; }
  /* Поля подписью сверху — когда колонка узкая и подпись слева съедает ввод */
  /* Колонка флекса не растягивает детей по ширине: без stretch каждое поле
     получало ширину своего содержимого и колонка шла вразнобой */
  .pvform-field-top { flex-direction: column; align-items: stretch; gap: 0.25rem; }
  .pvform-field-top .pvform-label { width: auto; padding-top: 0; }
  .pvform-field-top .pvform-control { width: 100%; }

  /* inline-режим (флекс в строку) оставлен как был до блоков */
  .pvform-inline { display: flex; flex-wrap: wrap; gap: 1rem; }

  /* Виджеты PrimeVue тянем на ширину поля: иначе дата и время выпадают
     из общей сетки и выглядят короче соседей */
  .pvform-control .p-datepicker,
  .pvform-control .p-inputtext,
  .pvform-control .p-select,
  .pvform-control .p-inputnumber,
  .pvform-control .p-textarea,
  .pvform-control .p-autocomplete { width: 100%; }
  .pvform-control .p-datepicker .p-inputtext { width: 100%; }

  /* Адаптив: сначала ужимаем ряды блоков, потом колонки полей,
     в самом узком — подпись уезжает наверх */
  @container (max-width: 1200px) {
    .pvform-blocks[data-cols="3"],
    .pvform-blocks[data-cols="4"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pvform-grid[data-cols="3"],
    .pvform-grid[data-cols="4"]   { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @container (max-width: 860px) {
    .pvform-blocks[data-cols="2"],
    .pvform-blocks[data-cols="3"],
    .pvform-blocks[data-cols="4"] { grid-template-columns: minmax(0, 1fr); }
    .pvform-grid[data-cols="2"],
    .pvform-grid[data-cols="3"],
    .pvform-grid[data-cols="4"]   { grid-template-columns: minmax(0, 1fr); }
  }
  @container (max-width: 520px) {
    .pvform-field { flex-direction: column; align-items: stretch; gap: 0.25rem; }
    .pvform-field .pvform-label { width: auto; padding-top: 0; }
    .pvform-control { width: 100%; max-width: 100% !important; }
  }
</style>
