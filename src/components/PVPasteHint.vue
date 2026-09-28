<template>
  <!-- Подсказка после вставки из Excel, как в Excel: вставилось сразу, а тут
       можно поменять разбор или отменить. Держим до клика по крестику —
       успевают посмотреть, что получилось и что не вставилось. -->
  <div v-if="paste.info.value || paste.busy.value" class="pv-paste-hint">
    <template v-if="paste.busy.value">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Вставляю строки, подождите…</span>
    </template>
    <template v-else>
      <i class="pi pi-check-circle"></i>
      <span>
        Вставлено строк: <b>{{ paste.info.value.count }}</b>
        <template v-if="paste.info.value.updated"> · обновлено: <b>{{ paste.info.value.updated }}</b></template>
      </span>
      <Button label="Параметры вставки" icon="pi pi-cog" text size="small"
              @click="paste.optionsOpen.value = !paste.optionsOpen.value"/>
      <Button label="Отменить" icon="pi pi-undo" text severity="danger" size="small"
              :loading="paste.busy.value" @click="paste.undoPaste()"/>
      <Button icon="pi pi-times" text size="small" severity="secondary" @click="paste.close()"/>
      <!-- Что не вставилось и почему — текстом, а не в title. -->
      <ul v-if="paste.info.value.warnings.length" class="pv-paste-hint-warns">
        <li v-for="(w, i) in paste.info.value.warnings" :key="i">
          <i class="pi pi-exclamation-triangle"></i> {{ w }}
        </li>
      </ul>
      <div v-if="paste.optionsOpen.value" class="pv-paste-hint-options">
        <label>
          <Checkbox v-model="paste.options.value.skip_first" binary @change="paste.apply(true)"/>
          Первая строка — заголовок
        </label>
        <label>
          <Checkbox v-model="paste.options.value.decimal_comma" binary @change="paste.apply(true)"/>
          Запятая — десятичный разделитель
        </label>
      </div>
    </template>
  </div>
</template>

<script setup>
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'

// paste — объект из useTablePaste (рефы внутри, поэтому .value в шаблоне).
defineProps({ paste: { type: Object, required: true } })
</script>

<style>
.pv-paste-hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .5rem;
  margin-bottom: .5rem;
  padding: .4rem .75rem;
  border: 1px solid var(--gts-line, #e5e7eb);
  border-left: 3px solid var(--gts-ok, #3E8E5F);
  border-radius: var(--gts-radius, 6px);
  background: var(--gts-surface-2, #f8fafc);
  color: var(--gts-ink, #111827);
  font-size: var(--gts-size-sm, .875rem);
}
.pv-paste-hint > .pi-check-circle { color: var(--gts-ok, #3E8E5F); }
.pv-paste-hint-warns {
  flex-basis: 100%;
  margin: 0;
  padding: .35rem 0 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: .15rem;
  color: var(--gts-warn, #b45309);
}
.pv-paste-hint-warns .pi { margin-right: .3rem; }
.pv-paste-hint-options {
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding-top: .4rem;
  border-top: 1px solid var(--gts-line, #e5e7eb);
}
.pv-paste-hint-options label {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  cursor: pointer;
}
</style>
