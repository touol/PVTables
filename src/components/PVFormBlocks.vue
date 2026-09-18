<template>
  <!-- Один блок = одна смысловая группа полей карточки («Основное», «Размеры»).
       Раскладка внутри блока — грид: колонки задаются конфигом, а не вёрсткой. -->
  <div
    v-for="(block, bi) in blocks"
    :key="block.key || bi"
    class="pvform-block"
    :class="{ 'pvform-block-spaced': blocks.length > 1 }"
  >
    <div v-if="block.label" class="pvform-block-title">{{ block.label }}</div>
    <div
      :class="blockClass(block)"
      :style="block.cols > 1 ? { gridTemplateColumns: `repeat(${block.cols}, minmax(0, 1fr))` } : null"
    >
      <div
        v-for="col of block.fields"
        :key="col.field"
        class="pvform-field flex flex-wrap items-start gap-4 mb-4"
        :class="{ 'pvform-field-top': labelPosition === 'top' }"
        :style="fieldStyle(col, block)"
      >
        <label :for="col.field" class="font-semibold pt-2" :class="labelPosition === 'top' ? 'pvform-label-top' : 'w-24'">
          {{ col.label }}
          <span v-if="isFieldRequired(col)" class="text-red-500 ml-1">*</span>
        </label>
        <div class="flex-1" :style="{ maxWidth: fieldWidth }">
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
</template>

<script>
import EditField from "./EditField.vue";

export default {
  name: 'PVFormBlocks',
  components: { EditField },
  props: {
    // [{ key, label, cols, fields: [колонка, ...] }]
    blocks: { type: Array, default: () => [] },
    // Объект модели правим по ссылке — как это делал PVForm до выделения блоков
    model: { type: Object, default: () => ({}) },
    autocompleteSettings: { type: Object, default: () => ({}) },
    selectSettings: { type: Object, default: () => ({}) },
    fieldWidth: { type: String, default: '24rem' },
    labelPosition: { type: String, default: 'left' },
    inline: { type: Boolean, default: false },
  },
  emits: ['set-value'],
  methods: {
    blockClass(block) {
      if (block.cols > 1) return 'pvform-grid'
      // Без колонок ведём себя ровно как раньше: inline — флекс, иначе список
      return this.inline ? 'flex flex-wrap gap-4' : ''
    },
    fieldStyle(col, block) {
      if (!(block.cols > 1)) return null
      const span = Number(col.col_span) || 1
      if (span <= 1) return null
      return { gridColumn: `span ${Math.min(span, block.cols)}` }
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
  .pvform-grid {
    display: grid;
    column-gap: 1.5rem;
    align-items: start;
  }
  .pvform-block-spaced {
    margin-bottom: 1.5rem;
  }
  .pvform-block-title {
    font-weight: 600;
    margin-bottom: 0.75rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--p-content-border-color, #e5e7eb);
  }
  /* Подпись сверху — для узких колонок, где «подпись слева» съедает всё место */
  .pvform-field-top {
    flex-direction: column;
    gap: 0.25rem !important;
  }
  .pvform-label-top {
    padding-top: 0 !important;
  }
</style>
