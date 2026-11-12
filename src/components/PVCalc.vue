<template>
  <!-- Калькулятор (замена ExcelCalc getTables): книги-формулы из таблицы gtsAPI (props.table), пересчёт xlsx-calc.
       Поле с калькулятором — у числового поля в конфиге `calc: '<таблица книг>'`: кнопка в поле формы и в ячейке,
       «Вставить» у результата формулы подставляет число. Окно — своё (без PrimeVue), в body, цвета — токены темы. -->
  <button type="button" :class="compact ? 'pv-calc-mini' : 'pv-calc-open'" :title="compact ? 'Калькулятор' : 'Калькулятор: книги с формулами'"
          @click.stop="openDlg" @mousedown.stop @dblclick.stop>
    <i class="pi pi-calculator"></i><span v-if="!compact"> {{ label }}</span>
  </button>

  <Teleport to="body">
    <div v-if="open" class="pv-calc-back" @mousedown.self="open = false" @click.stop @dblclick.stop>
      <div class="pv-calc-dlg" role="dialog" aria-label="Калькулятор" tabindex="-1" ref="dlg" @keydown.esc="open = false">
        <div class="pv-calc-head">
          <b>Калькулятор</b>
          <span v-if="note" class="pv-calc-note">{{ note }}</span>
          <button type="button" class="pv-calc-x" title="Закрыть" @click="open = false"><i class="pi pi-times"></i></button>
        </div>
        <div class="pv-calc-body">
          <nav class="pv-calc-books">
            <button v-for="b in books" :key="b.id" type="button" class="pv-calc-book" :class="{ 'pv-calc-book-on': b.id === bookId }"
                    @click="pick(b)">{{ b.name }}</button>
            <p v-if="!books.length" class="pv-calc-hint">{{ loading ? 'Загрузка…' : 'Книг нет' }}</p>
          </nav>
          <div class="pv-calc-sheet">
            <div v-if="canEdit && bookId" class="pv-calc-tools">
              <button type="button" class="pv-calc-btn" @click="addRow">+ строка</button>
              <button type="button" class="pv-calc-btn" @click="delRow">− строка</button>
              <button type="button" class="pv-calc-btn" @click="addCol">+ столбец</button>
              <button type="button" class="pv-calc-btn" @click="delCol">− столбец</button>
              <button type="button" class="pv-calc-btn pv-calc-btn-main" :disabled="saving" @click="save">Сохранить книгу</button>
            </div>
            <p class="pv-calc-hint">Щёлкните ячейку, чтобы ввести число; формула начинается с «=».
              <template v-if="insert">Результат формулы — кнопкой «Вставить» в поле.</template>
              <template v-else>Результат формулы — кнопкой <i class="pi pi-copy"></i> в буфер обмена.</template></p>
            <div class="pv-calc-scroll">
              <table v-if="bookId" class="pv-calc-table">
                <thead>
                  <tr><th></th><th v-for="c in cols" :key="c">{{ c }}</th></tr>
                </thead>
                <tbody>
                  <tr v-for="r in rows" :key="r">
                    <th>{{ r }}</th>
                    <td v-for="c in cols" :key="c" :class="{ 'pv-calc-f': isF(c + r), 'pv-calc-edit': edit === c + r }" @click="startEdit(c + r)">
                      <input v-if="edit === c + r" ref="inp" v-model="editVal" class="pv-calc-input"
                             @keydown.enter.prevent="commit" @keydown.esc.stop.prevent="edit = ''" @blur="commit" />
                      <template v-else>
                        <span>{{ show(c + r) }}</span>
                        <button v-if="isF(c + r) && insert" type="button" class="pv-calc-ins" title="Вставить в поле"
                                @click.stop="doInsert(c + r)">Вставить</button>
                        <button v-else-if="isF(c + r)" type="button" class="pv-calc-copy" title="Скопировать результат"
                                @click.stop="copy(c + r)"><i class="pi pi-copy"></i></button>
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import XLSX_CALC from 'xlsx-calc'
import apiCtor from './api'

const props = defineProps({
  table:   { type: String, default: 'gcCalcBook' },   // таблица gtsAPI с книгами: name, workbook (JSON), active
  compact: { type: Boolean, default: false },         // маленькая кнопка в поле / ячейке
  insert:  { type: Boolean, default: false },         // «Вставить» у результата формулы → событие insert
  canEdit: { type: Boolean, default: false },         // правка книги (строки, столбцы, «Сохранить книгу»)
  label:   { type: String, default: 'Калькулятор' },
})
const emit = defineEmits(['insert'])
const api = apiCtor(props.table)
const open = ref(false)
const loading = ref(false)
const saving = ref(false)
const books = ref([])
const bookId = ref(0)
const sheet = ref({})          // ячейки книги: { A1: { v, f } }
const edit = ref('')
const editVal = ref('')
const inp = ref(null)
const dlg = ref(null)
const note = ref('')

const colName = (n) => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - r) / 26) } return s }
const colNum = (s) => s.toUpperCase().split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0)
const size = computed(() => {
  let maxC = 5, maxR = 1
  for (const k of Object.keys(sheet.value)) {
    const m = k.match(/^([A-Z]+)(\d+)$/)
    if (!m) continue
    maxC = Math.max(maxC, colNum(m[1])); maxR = Math.max(maxR, +m[2])
  }
  return { c: maxC, r: maxR }
})
const cols = computed(() => Array.from({ length: size.value.c }, (_, i) => colName(i + 1)))
const rows = computed(() => Array.from({ length: size.value.r }, (_, i) => i + 1))
const isF = (a) => !!sheet.value[a]?.f
const num = (a) => { const v = sheet.value[a]?.v; return typeof v === 'number' ? Math.round(v * 1000) / 1000 : Number(String(v ?? '').replace(',', '.')) }
const show = (a) => {
  const v = sheet.value[a]?.v
  if (v === undefined || v === null) return ''
  return typeof v === 'number' ? String(Math.round(v * 1000) / 1000).replace('.', ',') : v
}

const recalc = () => {
  const wb = { Sheets: { Sheet1: sheet.value } }
  try { XLSX_CALC(wb) } catch (e) { /* формула с ошибкой — оставляем как есть */ }
  sheet.value = { ...wb.Sheets.Sheet1 }
}
const pick = (b) => {
  bookId.value = b.id
  let wb = {}
  try { wb = typeof b.workbook === 'string' ? JSON.parse(b.workbook || '{}') : (b.workbook || {}) } catch (e) { wb = {} }
  sheet.value = JSON.parse(JSON.stringify(wb.Sheets?.Sheet1 || { A1: { v: '' } }))
  recalc()
}
const load = async () => {
  loading.value = true
  try {
    const r = await api.read({ limit: 0 })
    books.value = (r?.data?.rows || []).filter(b => b.active === undefined || +b.active)
    if (books.value.length && !bookId.value) pick(books.value[0])
  } catch (e) { note.value = 'Книги не загрузились' } finally { loading.value = false }
}
const openDlg = async () => {
  open.value = true
  note.value = ''
  if (!books.value.length) await load()
  await nextTick()
  dlg.value?.focus()
}

const startEdit = async (a) => {
  if (edit.value === a) return
  edit.value = a
  const c = sheet.value[a]
  editVal.value = c?.f ? '=' + c.f : (c?.v ?? '')
  await nextTick()
  const el = Array.isArray(inp.value) ? inp.value[0] : inp.value
  el?.focus(); el?.select()
}
const commit = () => {
  const a = edit.value
  if (!a) return
  edit.value = ''
  const t = String(editVal.value ?? '').trim()
  const cell = {}
  if (t.startsWith('=')) { cell.f = t.slice(1); cell.v = '' }
  else if (t !== '' && !isNaN(Number(t.replace(',', '.')))) cell.v = Number(t.replace(',', '.'))
  else cell.v = t
  sheet.value = { ...sheet.value, [a]: cell }
  recalc()
}
const doInsert = (a) => {
  const v = num(a)
  if (isNaN(v)) { note.value = 'В ячейке не число'; return }
  emit('insert', v)
  open.value = false
}
const copy = async (a) => {
  const v = show(a)
  try { await navigator.clipboard.writeText(String(v)) } catch (e) { /* без доступа к буферу — просто показываем */ }
  note.value = 'Скопировано: ' + v
}

// правка книги: строки и столбцы с конца, сохранение (права — у таблицы книг)
const addRow = () => { sheet.value = { ...sheet.value, ['A' + (size.value.r + 1)]: { v: '' } } }
const addCol = () => { sheet.value = { ...sheet.value, [colName(size.value.c + 1) + '1']: { v: '' } } }
const delRow = () => {
  const r = String(size.value.r); const s = { ...sheet.value }
  for (const k of Object.keys(s)) if (k.replace(/^[A-Z]+/, '') === r) delete s[k]
  sheet.value = s
}
const delCol = () => {
  const c = colName(size.value.c); const s = { ...sheet.value }
  for (const k of Object.keys(s)) if (k.replace(/\d+$/, '') === c) delete s[k]
  sheet.value = s
}
const save = async () => {
  saving.value = true
  try {
    const clean = {}
    for (const [k, c] of Object.entries(sheet.value)) clean[k] = c.f ? { v: '', f: c.f } : { v: c.v }
    const workbook = JSON.stringify({ Sheets: { Sheet1: clean } })
    const r = await api.update({ id: bookId.value, workbook })
    if (r?.success) {
      const b = books.value.find(x => x.id === bookId.value)
      if (b) b.workbook = workbook
      note.value = 'Книга сохранена'
    } else note.value = r?.message || 'Не сохранено'
  } catch (e) { note.value = 'Не сохранено' } finally { saving.value = false }
}
</script>

<style>
/* не scoped: окно уходит в body (Teleport) */
.pv-calc-open {
  display: inline-flex; align-items: center; gap: 0.35rem; height: var(--gts-control-h); padding: 0 0.75rem;
  border: 1px solid var(--gts-line-strong); border-radius: var(--gts-radius); background: var(--gts-surface);
  color: var(--gts-ink); font: inherit; font-size: var(--gts-size-base); cursor: pointer;
}
.pv-calc-open:hover, .pv-calc-mini:hover { background: var(--gts-surface-2); }
.pv-calc-mini {
  display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 2rem; min-height: 1.75rem;
  border: 1px solid var(--gts-line-strong); border-radius: var(--gts-radius); background: var(--gts-surface);
  color: var(--gts-ink-2); cursor: pointer; padding: 0;
}
.pv-calc-back { position: fixed; inset: 0; z-index: 5000; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--gts-ink) 45%, transparent); padding: 1rem; }
.pv-calc-dlg { display: flex; flex-direction: column; width: min(70rem, 100%); max-height: 90vh; background: var(--gts-surface);
  color: var(--gts-ink); border: 1px solid var(--gts-line-strong); border-radius: var(--gts-radius-lg, var(--gts-radius));
  box-shadow: 0 8px 32px color-mix(in srgb, var(--gts-ink) 25%, transparent); outline: none; font-size: var(--gts-size-base); }
.pv-calc-head { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.9rem; border-bottom: 1px solid var(--gts-line); font-size: var(--gts-size-lg); }
.pv-calc-note { font-size: var(--gts-size-sm); color: var(--gts-ink-2); }
.pv-calc-x { margin-left: auto; border: none; background: none; color: var(--gts-ink-2); font-size: 1.1rem; cursor: pointer; }
.pv-calc-body { display: flex; gap: 0.75rem; padding: 0.75rem; min-height: 0; overflow: hidden; }
.pv-calc-books { flex: 0 0 11rem; display: flex; flex-direction: column; gap: 0.25rem; overflow: auto; }
.pv-calc-book { text-align: left; padding: 0.4rem 0.6rem; border: 1px solid var(--gts-line); border-radius: var(--gts-radius);
  background: var(--gts-surface-2); color: var(--gts-ink); font: inherit; cursor: pointer; }
.pv-calc-book-on { background: var(--gts-accent); border-color: var(--gts-accent); color: var(--gts-accent-contrast); }
.pv-calc-sheet { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.pv-calc-tools { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.4rem; }
.pv-calc-btn { padding: 0.25rem 0.6rem; border: 1px solid var(--gts-line-strong); border-radius: var(--gts-radius);
  background: var(--gts-surface); color: var(--gts-ink); font: inherit; font-size: var(--gts-size-sm); cursor: pointer; }
.pv-calc-btn-main { background: var(--gts-accent); border-color: var(--gts-accent); color: var(--gts-accent-contrast); }
.pv-calc-hint { margin: 0 0 0.4rem; color: var(--gts-ink-3); font-size: var(--gts-size-sm); }
.pv-calc-scroll { overflow: auto; min-height: 0; border: 1px solid var(--gts-line-strong); border-radius: var(--gts-radius); }
.pv-calc-table { border-collapse: collapse; }
.pv-calc-table th { position: sticky; top: 0; background: var(--gts-surface-2); color: var(--gts-ink-2); font-weight: var(--gts-weight-medium, 500);
  padding: 0.25rem 0.5rem; border: 1px solid var(--gts-line); }
.pv-calc-table tbody th { position: sticky; left: 0; }
.pv-calc-table td { position: relative; min-width: 7rem; height: 2rem; padding: 0.2rem 0.5rem; border: 1px solid var(--gts-line);
  cursor: text; white-space: nowrap; color: var(--gts-ink); }
.pv-calc-f { background: var(--gts-accent-soft); font-weight: var(--gts-weight-bold, 700); padding-right: 5.5rem !important; }
.pv-calc-edit { padding: 0 !important; }
.pv-calc-input { width: 100%; height: 2rem; padding: 0 0.5rem; border: 2px solid var(--gts-accent); background: var(--gts-surface);
  color: var(--gts-ink); font: inherit; outline: none; }
.pv-calc-copy, .pv-calc-ins { position: absolute; top: 50%; right: 0.25rem; transform: translateY(-50%); cursor: pointer; }
.pv-calc-copy { border: none; background: none; color: var(--gts-accent); }
.pv-calc-ins { padding: 0.05rem 0.45rem; border: 1px solid var(--gts-accent); border-radius: var(--gts-radius);
  background: var(--gts-accent); color: var(--gts-accent-contrast); font: inherit; font-size: var(--gts-size-sm); font-weight: var(--gts-weight-medium, 500); }
</style>
