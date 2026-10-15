<template>
  <div class="gtsai">
    <div class="gtsai-head">
      <!-- На собственной странице заголовок уже напечатан шаблоном сайта,
           второй такой же рядом выглядит ошибкой. Список чатов остаётся. -->
      <span v-if="heading !== false" class="gtsai-title">{{ headingText }}</span>
      <select v-if="chats.length" class="gtsai-chats" :value="chatId" @change="openChat($event.target.value)">
        <option :value="0">Новый чат</option>
        <option v-for="c in chats" :key="c.id" :value="c.id">{{ c.title || ('чат ' + c.id) }}</option>
      </select>
    </div>

    <div class="gtsai-feed" ref="feed">
      <div v-for="(m, i) in messages" :key="i" :class="['gtsai-msg', 'gtsai-' + m.role]">
        <div v-if="m.role === 'user'" class="gtsai-text">{{ m.content }}</div>

        <!-- Разметку рисует готовый MdPreview: таблицы, HTML, формулы,
             диаграммы и кнопка копирования у блоков кода — всё его. -->
        <div v-else-if="m.role === 'assistant'" class="gtsai-md">
          <!-- Чем модель пользовалась. Показываем ПЕРЕД текстом: строки
               появляются по ходу работы, а текст дописывается под ними, и
               порядок не скачет. Заодно это видимый признак, что ответ ещё
               готовится - ход с инструментами идёт полминуты и дольше. -->
          <div v-if="m.tools && m.tools.length" class="gtsai-tools">
            <div v-for="(t, ti) in m.tools" :key="ti" class="gtsai-tool" :title="toolFull(t)">
              <span class="gtsai-tool-name">{{ t.name }}</span>
              <span v-if="toolArgs(t)" class="gtsai-tool-args">{{ toolArgs(t) }}</span>
            </div>
          </div>
          <Suspense>
            <MdPreview
              :model-value="m.content"
              :theme="scheme"
              language="ru-RU"
              preview-theme="default"
              code-theme="atom"
              :code-fold-able="false"
              no-img-zoom-in
            />
            <template #fallback>
              <div class="gtsai-text">{{ m.content }}</div>
            </template>
          </Suspense>
        </div>

        <!-- Правка ждёт подтверждения: сначала показываем, что изменится, и
             только потом пишем. Применяет сервер по pending_id — браузер не
             присылает, что менять. -->
        <div v-else-if="m.role === 'confirm'" class="gtsai-card">
          <div class="gtsai-card-head">
            {{ m.data.action === 'update' ? 'Изменить строк' : 'Создать строк' }}:
            {{ m.data.diff.length }} в «{{ m.data.table }}»
          </div>
          <div v-if="m.data.reason" class="gtsai-card-reason">{{ m.data.reason }}</div>
          <table class="gtsai-diff">
            <tr v-for="(row, i) in m.data.diff" :key="i">
              <td class="gtsai-diff-id">{{ row.id ? '#' + row.id : 'новая' }}</td>
              <td>
                <div v-for="(val, field) in row.will" :key="field">
                  {{ field }}:
                  <template v-if="row.id"><s>{{ fmt(row.was[field]) }}</s> → </template>
                  <b>{{ fmt(val) }}</b>
                </div>
              </td>
            </tr>
          </table>
          <div class="gtsai-card-foot">
            <!-- ⚠️ done хранит null, а не пустую строку: Vue трактует :disabled=""
                 как «отключено» (так же, как HTML), и кнопки были мёртвыми. -->
            <button class="gtsai-btn" :disabled="m.done" @click="apply(m)">Применить</button>
            <button class="gtsai-btn gtsai-secondary" :disabled="m.done" @click="m.done = 'отклонено'">Отклонить</button>
            <span v-if="m.done" class="gtsai-card-state">{{ m.done }}</span>
          </div>
        </div>

        <!-- Записано: остаётся откат одним жестом по batch_id. -->
        <div v-else-if="m.role === 'applied'" class="gtsai-card">
          <div class="gtsai-card-head">
            {{ m.data.action && m.data.action !== 'update' ? 'Создано строк' : 'Изменено строк' }}:
            {{ m.data.updated.length }} в «{{ m.data.table }}»
          </div>
          <div class="gtsai-card-foot">
            <button class="gtsai-btn gtsai-secondary" :disabled="m.done" @click="rollback(m)">Откатить</button>
            <span v-if="m.done" class="gtsai-card-state">{{ m.done }}</span>
          </div>
        </div>

        <div v-else class="gtsai-text">{{ m.content }}</div>
      </div>
      <div v-if="error" class="gtsai-error">{{ error }}</div>
    </div>

    <!-- Поле ввода и его кнопки — в одной рамке: так понятнее, что кнопки
         относятся к сообщению, и строка не расползается по ширине панели. -->
    <div class="gtsai-box" :class="{ 'gtsai-box--drop': dragging }"
         @dragover.prevent="dragging = true"
         @dragleave.prevent="dragging = false"
         @drop.prevent="onDrop">
      <!-- Вложения: снимок можно просто вставить из буфера, файл — перетащить
           или выбрать кнопкой. -->
      <div v-if="files.length" class="gtsai-files">
        <span v-for="f in files" :key="f.id" class="gtsai-file">
          {{ f.name }}
          <span class="gtsai-file-size">{{ kb(f.size) }}</span>
          <button class="gtsai-file-x" title="Убрать" @click="dropFile(f)">✕</button>
        </span>
      </div>

      <textarea
        ref="input"
        v-model="draft"
        :disabled="busy"
        rows="1"
        placeholder="Спросить ИИ…"
        @input="grow"
        @paste="onPaste"
        @keydown.enter.exact.prevent="send()"
      ></textarea>

      <div class="gtsai-box-foot">
        <button class="gtsai-attach" :disabled="busy || uploading" title="Прикрепить файл или снимок" @click="pick">
          {{ uploading ? '…' : '+' }}
        </button>
        <input ref="picker" type="file" multiple accept="image/*,application/pdf,.xlsx,.xlsm,.xls,.csv" hidden @change="onPick">
        <select
          v-if="models.length"
          v-model="model"
          class="gtsai-chip gtsai-chip--select"
          title="Модель"
          @change="rememberModel"
        >
          <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <span v-else class="gtsai-chip">{{ model }}</span>
        <!-- Переключатель режима записи: спрашивать подтверждение или писать
             сразу. Виден только там, где запись вообще разрешена. -->
        <button
          v-if="canWrite"
          class="gtsai-chip gtsai-chip--btn"
          :class="{ 'gtsai-chip--on': !askConfirm }"
          :disabled="busy || confirmLock"
          :title="confirmLock
            ? 'Подтверждение включено настройкой чата и здесь не отключается'
            : (askConfirm ? 'Сейчас: показать правку и ждать кнопку' : 'Сейчас: применять сразу, с кнопкой отката')"
          @click="toggleConfirm"
        >{{ askConfirm ? 'спрашивать' : 'сразу' }}</button>
        <button v-if="echo" class="gtsai-chip gtsai-chip--btn" :disabled="busy" @click="send('/echo')">Тест стрима</button>
        <span class="gtsai-box-spacer"></span>
        <!-- Enter отправляет, поэтому кнопка — подсказка, а не единственный путь. -->
        <button
          v-if="!busy"
          class="gtsai-send"
          :disabled="!draft.trim() && !files.length"
          title="Отправить (Enter)"
          @click="send()"
        >↑</button>
        <button v-else class="gtsai-send gtsai-send--stop" title="Остановить" @click="stop">■</button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Чат ИИ. Говорит со шлюзом /gtsai (компонент gtsAI).
 *
 * Живёт в PVTables, потому что PVTables уже есть на каждой странице: иначе
 * страница вроде расчёта тянула бы второй Vue-app ради одного чата.
 *
 * Всё, что решает поведение чата (промпт, права, модель, лимиты), лежит в базе
 * за именем настроек. Снаружи передаётся только это имя — ключ, не параметры.
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick, defineAsyncComponent } from 'vue'

/**
 * changed — данные в системе изменились (ИИ применил правку или её откатили).
 * Хост по этому событию перечитывает то, что показывает: иначе на экране
 * остаются старые цифры, а человек думает, что правка не прошла.
 */
const emit = defineEmits(['changed'])

const props = defineProps({
  /** Имя настроек чата (gtsAISetting.name): промпт, права, модель, лимиты. */
  setting: { type: String, default: 'default' },
  /** Заголовок; пусто — возьмём из настроек. */
  title: { type: String, default: '' },
  /** Путь страницы для контекста; пусто — текущий адрес. */
  page: { type: String, default: '' },
  /**
   * Параметры страницы (из них сервер берёт область работы — raschet_id и
   * подобное). Пусто — разберём строку запроса.
   */
  params: { type: Object, default: null },
  /** Кнопка «Тест стрима» — нужна на странице отладки, не в рабочем окне. */
  echo: { type: Boolean, default: false },
  /** Показывать свой заголовок. false — когда страница назвала чат сама. */
  heading: { type: Boolean, default: true },
})

const settingTitle = ref('')
const model = ref('')
const models = ref([])
const canWrite = ref(false)
const confirmLock = ref(false)
const askConfirm = ref(true)
const messages = ref([])
const draft = ref('')
const busy = ref(false)
const error = ref('')
const chatId = ref(0)
const chats = ref([])
const feed = ref()
let controller = null

const headingText = computed(() => props.title || settingTitle.value || 'Чат ИИ')

const pageContext = () => ({
  page: props.page || location.pathname,
  get: props.params || Object.fromEntries(new URLSearchParams(location.search)),
})

// Предпросмотр грузится динамическим import() — значит уедет в ленивый чанк,
// а не в pvtables.js, который есть на каждой странице.
const MdPreview = defineAsyncComponent(async () => (await import('./preview.js')).MdPreview)

// Светлая или тёмная — та же, что у сайта: у MdPreview своя тема, и без этого
// чат остался бы светлым на тёмной странице.
const scheme = ref(document.documentElement.getAttribute('data-gts-scheme') === 'dark' ? 'dark' : 'light')
let schemeWatch = null

// Пока ответ течёт, показываем «дозакрытый» хвост: иначе мигают незакрытые
// блоки кода и половинки таблиц.
let heal = null
const healIfNeeded = async (m) => {
  if (!heal) heal = (await import('./markdown.js')).healPartial
  m.shown = heal(m.content)
}

onMounted(() => {
  // Тему переключает сайт атрибутом на <html> — следим за ним.
  schemeWatch = new MutationObserver(() => {
    scheme.value = document.documentElement.getAttribute('data-gts-scheme') === 'dark' ? 'dark' : 'light'
  })
  schemeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-gts-scheme'] })
})

onBeforeUnmount(() => {
  if (schemeWatch) { schemeWatch.disconnect(); schemeWatch = null }
})

onMounted(async () => {
  try {
    const r = await fetch('/gtsai/settings?setting=' + encodeURIComponent(props.setting), { credentials: 'same-origin' })
    const j = await r.json()
    if (!j.success) { error.value = j.message; return }
    settingTitle.value = j.data.title || ''
    model.value = j.data.model || ''
    canWrite.value = !!j.data.allow_write
    confirmLock.value = !!j.data.confirm_lock
    askConfirm.value = !!j.data.confirm_write
    // Выбор человека помним, но замок настройки сильнее.
    if (!confirmLock.value) {
      try {
        const saved = localStorage.getItem('gtsai_confirm_' + props.setting)
        if (saved !== null) askConfirm.value = saved === '1'
      } catch (e) { /* приватное окно — не помним */ }
    }
    if (j.data.save_history) loadChats()
    loadModels()
  } catch (e) {
    error.value = 'Не удалось получить настройки чата: ' + e.message
  }
})

// Список моделей спрашиваем у провайдера через шлюз: зашитый перечень устарел
// бы молча, а так в выборе ровно то, что подключение правда умеет.
const modelKey = () => 'gtsai_model_' + props.setting

const loadModels = async () => {
  try {
    const r = await fetch('/gtsai/models?setting=' + encodeURIComponent(props.setting), { credentials: 'same-origin' })
    const j = await r.json()
    if (!j.success) return
    models.value = j.data.models || []

    // Выбор человека помним у него же: это предпочтение рабочего места.
    let saved = null
    try { saved = localStorage.getItem(modelKey()) } catch (e) { /* приватное окно — не помним */ }
    if (saved && models.value.some((m) => m.id === saved)) model.value = saved
  } catch (e) {
    // Не ответил — останется подпись с текущей моделью, чат от этого не ломается.
  }
}

const toggleConfirm = () => {
  if (confirmLock.value) return
  askConfirm.value = !askConfirm.value
  try { localStorage.setItem('gtsai_confirm_' + props.setting, askConfirm.value ? '1' : '0') } catch (e) { /* не помним */ }
}

const rememberModel = () => {
  try { localStorage.setItem(modelKey(), model.value) } catch (e) { /* не помним */ }
}

const loadChats = async () => {
  try {
    const r = await fetch('/gtsai/chats?setting=' + encodeURIComponent(props.setting), { credentials: 'same-origin' })
    const j = await r.json()
    if (j.success) chats.value = j.rows || []
  } catch (e) {
    // Список чатов — удобство, а не условие работы: молча обходимся без него.
  }
}

// Открыть прежний чат. Заявки, которые ждут подтверждения, восстанавливаем
// карточками: перезагрузка страницы не должна их терять.
const openChat = async (id) => {
  id = parseInt(id, 10) || 0
  error.value = ''
  messages.value = []
  chatId.value = id
  if (!id) return

  try {
    const r = await fetch('/gtsai/chat/' + id, { credentials: 'same-origin' })
    const j = await r.json()
    if (!j.success) { error.value = j.message; return }

    for (const row of j.rows || []) {
      if (row.role === 'user' || row.role === 'assistant') {
        // У ответа в blocks лежат шаги хода - те же вызовы, что показывались
        // вживую. Достаём их, чтобы открытый заново чат выглядел так же.
        const msg = { role: row.role, content: row.content || '' }
        if (row.role === 'assistant' && row.blocks) {
          try {
            const b = JSON.parse(row.blocks)
            const tools = []
            for (const step of b.turn || []) {
              if (step.role !== 'assistant' || !Array.isArray(step.content)) continue
              for (const block of step.content) {
                if (block.type === 'tool_use') tools.push({ name: block.name, input: block.input })
              }
            }
            if (tools.length) msg.tools = tools
          } catch (e) { /* старый чат без шагов - покажем как есть */ }
        }
        messages.value.push(msg)
      } else if (row.role === 'pending') {
        let data = {}
        try { data = JSON.parse(row.blocks || '{}') } catch { data = {} }
        if (data.table) {
          messages.value.push({
            role: 'confirm',
            data: { ...data, pending_id: row.id, reason: row.content || '' },
            done: null,
          })
        }
      }
    }
    scroll()
  } catch (e) {
    error.value = 'Не удалось открыть чат: ' + e.message
  }
}

const input = ref()
const picker = ref()
const files = ref([])
const uploading = ref(false)
const dragging = ref(false)

const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ')

const pick = () => picker.value?.click()
const onPick = (e) => { upload(Array.from(e.target.files || [])); e.target.value = '' }
const onDrop = (e) => { dragging.value = false; upload(Array.from(e.dataTransfer?.files || [])) }

// Снимок экрана вставляется прямо в поле — самый частый способ показать,
// о чём речь, поэтому отдельной кнопки для него не нужно.
const onPaste = (e) => {
  const picked = Array.from(e.clipboardData?.items || [])
    .filter((i) => i.kind === 'file')
    .map((i) => i.getAsFile())
    .filter(Boolean)
  if (picked.length) { e.preventDefault(); upload(picked) }
}

// Грузим сразу, не дожидаясь отправки: так видно имя и размер, а ошибка
// (не тот тип, слишком большой) приходит до того, как написан вопрос.
const upload = async (list) => {
  if (!list.length) return
  uploading.value = true
  for (const file of list) {
    try {
      const form = new FormData()
      form.append('file', file, file.name || 'снимок.png')
      form.append('setting', props.setting)
      form.append('chat_id', chatId.value)
      const r = await fetch('/gtsai/upload', { method: 'POST', credentials: 'same-origin', body: form })
      const j = await r.json()
      if (!j.success) { error.value = j.message; continue }
      files.value.push(j.data)
    } catch (e) {
      error.value = 'Не удалось загрузить файл: ' + e.message
    }
  }
  uploading.value = false
}

const dropFile = (f) => { files.value = files.value.filter((x) => x.id !== f.id) }

// Поле растёт под текст, но не бесконечно: дальше прокрутка внутри него.
const grow = () => {
  const el = input.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 180) + 'px'
}

const scroll = async () => {
  await nextTick()
  if (feed.value) feed.value.scrollTop = feed.value.scrollHeight
}

const stop = () => {
  // Обрыв соединения гасит и запрос на сервере: шлюз стоит с
  // ignore_user_abort(false), то есть токены дальше не жгутся.
  if (controller) controller.abort()
  busy.value = false
}

const send = async (route = '/message') => {
  const text = route === '/echo' ? 'Проверка стрима gtsAI' : draft.value.trim()
  const attached = route === '/echo' ? [] : files.value.map((f) => f.id)
  if ((!text && !attached.length) || busy.value) return

  error.value = ''
  busy.value = true
  if (route !== '/echo') { draft.value = ''; nextTick(grow) }

  const shown = attached.length
    ? (text ? text + '\n' + filesLine(attached) : filesLine(attached))
    : text
  messages.value.push({ role: 'user', content: shown })
  if (attached.length) files.value = []
  messages.value.push({ role: 'assistant', content: '' })
  // ⚠️ Дальше работаем с РЕАКТИВНЫМ объектом из массива, а не с тем, что
  // положили. Мутация исходного объекта меняет данные, но перерисовку не
  // запускает: текст ответа появлялся только потому, что рядом менялись другие
  // реактивные значения, а разметка, приходящая ПОСЛЕ конца потока, на экран
  // уже не попадала — ответ так и оставался сырым markdown.
  const answer = messages.value[messages.value.length - 1]
  scroll()

  controller = new AbortController()
  try {
    const r = await fetch('/gtsai' + route, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        setting: props.setting,
        text,
        model: model.value,
        confirm: askConfirm.value,
        file_ids: attached,
        chat_id: chatId.value,
        // Контекст страницы: адрес и параметры. Данные ИИ берёт инструментами сам.
        ...pageContext(),
      }),
    })

    const reader = r.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      // Кадр SSE может прийти разрезанным между чанками — неполный остаётся в буфере.
      let pos
      while ((pos = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, pos)
        buf = buf.slice(pos + 2)
        handle(frame, answer)
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') error.value = 'Обрыв: ' + e.message
  } finally {
    busy.value = false
    controller = null
    // Ответ дописан (или оборван) — дальше показываем его как есть.
    answer.shown = answer.content
    if (chatId.value && !chats.value.some((c) => String(c.id) === String(chatId.value))) loadChats()
  }
}

const handle = (frame, answer) => {
  let event = ''
  let data = ''
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!data) return

  let payload
  try { payload = JSON.parse(data) } catch { return }

  if (event === 'delta') {
    answer.content += payload.text || ''
    healIfNeeded(answer)
    scroll()
  } else if (event === 'tool') {
    if (!answer.tools) answer.tools = []
    answer.tools.push({ name: payload.name, input: payload.input })
    scroll()
  } else if (event === 'error') {
    error.value = payload.message || 'Ошибка ИИ'
  } else if (event === 'confirm') {
    messages.value.push({ role: 'confirm', data: payload, done: null })
    scroll()
  } else if (event === 'applied') {
    if (payload.success) {
      messages.value.push({ role: 'applied', data: payload, done: null })
      emit('changed', { table: payload.table, ids: payload.updated, batch_id: payload.batch_id })
    } else {
      error.value = payload.message || 'Правка не применилась'
    }
    scroll()
  } else if (event === 'done' || event === 'start') {
    if (payload.chat_id) chatId.value = payload.chat_id
  }
}

/**
 * Короткая подпись вызова: таблица, действие, число строк - то, по чему
 * человек понимает, что происходит. Полные аргументы висят в подсказке:
 * в ленте они занимали бы пол-экрана.
 */
const toolArgs = (t) => {
  const i = t && t.input && typeof t.input === 'object' ? t.input : {}
  const parts = []
  if (i.table) parts.push(i.table)
  if (i.action) parts.push(i.action)
  if (i.name && !i.table) parts.push(i.name)
  if (Array.isArray(i.rows)) parts.push('строк: ' + i.rows.length)
  if (i.filters && typeof i.filters === 'object') {
    const keys = Object.keys(i.filters)
    if (keys.length) parts.push('фильтр: ' + keys.join(', '))
  }
  if (i.query) parts.push(String(i.query).replace(/\s+/g, ' ').slice(0, 60))
  if (!parts.length && i.limit) parts.push('до ' + i.limit)
  return parts.join(' · ')
}

const toolFull = (t) => {
  try { return t.name + ': ' + JSON.stringify(t.input) } catch (e) { return t.name }
}

const fmt = (v) => (v === null || v === undefined || v === '' ? '—' : String(v))

// В ленте показываем, что было приложено: содержимое ушло модели, а человеку
// нужно видеть сам факт и имена.
const filesLine = (ids) => '📎 ' + files.value.filter((f) => ids.includes(f.id)).map((f) => f.name).join(', ')

// Применяем по id заявки: что именно менять, сервер берёт из сохранённой
// заявки, а не из того, что прислал браузер.
const apply = async (m) => {
  m.done = 'применяю…'
  try {
    const r = await fetch('/gtsai/apply', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setting: props.setting, pending_id: m.data.pending_id }),
    })
    const j = await r.json()
    if (!j.success) { m.done = null; error.value = j.message; return }
    m.done = 'применено'
    messages.value.push({ role: 'applied', data: j.data, done: null })
    emit('changed', { table: j.data.table, ids: j.data.updated, batch_id: j.data.batch_id })
    scroll()
  } catch (e) {
    m.done = null
    error.value = 'Не удалось применить: ' + e.message
  }
}

const rollback = async (m) => {
  m.done = 'откатываю…'
  try {
    const r = await fetch('/gtsai/rollback', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setting: props.setting, batch_id: m.data.batch_id }),
    })
    const j = await r.json()
    m.done = j.success ? 'откатано' : ''
    if (j.success) emit('changed', { table: m.data.table, ids: m.data.updated, batch_id: m.data.batch_id })
    else error.value = j.message
  } catch (e) {
    m.done = null
    error.value = 'Не удалось откатить: ' + e.message
  }
}

defineExpose({ openChat, loadChats })
</script>

<style scoped>
/* Цвет только из токенов темы: своих хексов и палитры PrimeVue быть не должно,
   иначе тёмная схема ломается. */
.gtsai {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 20rem;
  background: var(--gts-surface);
  color: var(--gts-ink);
  border: 1px solid var(--gts-line);
  border-radius: var(--gts-radius);
}
.gtsai-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--gts-line);
}
.gtsai-title { font-weight: var(--gts-weight-head); }
.gtsai-chats {
  flex: 1;
  min-width: 6rem;
  max-width: 14rem;
  height: var(--gts-control-h-sm);
  background: var(--gts-surface);
  color: var(--gts-ink);
  border: 1px solid var(--gts-field-border);
  border-radius: var(--gts-radius-s);
  font: inherit;
  font-size: var(--gts-size-sm);
}
/* Вызовы инструментов: служебная строка, читать её не обязательно -
   поэтому мельче и приглушённее текста ответа. */
.gtsai-tools {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin-bottom: 0.5rem;
  padding-left: 0.5rem;
  border-left: 2px solid var(--gts-line);
}
.gtsai-tool {
  display: flex;
  gap: 0.375rem;
  align-items: baseline;
  font-size: var(--gts-size-sm);
  color: var(--gts-ink-3, var(--gts-ink-2));
  line-height: 1.3;
}
.gtsai-tool-name { font-family: var(--gts-font-mono, monospace); color: var(--gts-ink-2); }
.gtsai-tool-args {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gtsai-feed { flex: 1; overflow-y: auto; padding: 0.75rem; }
.gtsai-msg { margin-bottom: 0.75rem; }
.gtsai-text { white-space: pre-wrap; word-break: break-word; }
.gtsai-user .gtsai-text {
  background: var(--gts-surface-2);
  border-radius: var(--gts-radius);
  padding: 0.5rem 0.625rem;
}
.gtsai-assistant .gtsai-text { color: var(--gts-ink); }

.gtsai-md { word-break: break-word; }
.gtsai-md :deep(p) { margin: 0 0 0.5rem; }
.gtsai-md :deep(p:last-child) { margin-bottom: 0; }
.gtsai-md :deep(ul), .gtsai-md :deep(ol) { margin: 0 0 0.5rem; padding-left: 1.25rem; }
.gtsai-md :deep(h1), .gtsai-md :deep(h2), .gtsai-md :deep(h3) {
  margin: 0.5rem 0 0.375rem;
  font-size: var(--gts-size-base);
  font-weight: var(--gts-weight-head);
  color: var(--gts-head-ink);
}
.gtsai-md :deep(table) { border-collapse: collapse; margin-bottom: 0.5rem; font-size: var(--gts-size-sm); }
.gtsai-md :deep(th), .gtsai-md :deep(td) {
  border: 1px solid var(--gts-table-cell-border);
  padding: var(--gts-cell-pad-y) var(--gts-cell-pad-x);
  text-align: left;
}
.gtsai-md :deep(th) { background: var(--gts-table-head-bg); color: var(--gts-table-head-ink); }
.gtsai-md :deep(a) { color: var(--gts-link); }
.gtsai-md :deep(a:hover) { color: var(--gts-link-hover); }
.gtsai-md :deep(code) {
  font-family: var(--gts-font-mono);
  font-size: 0.9em;
  background: var(--gts-surface-3);
  border-radius: var(--gts-radius-s);
  padding: 0 0.2em;
}
.gtsai-md :deep(pre) {
  margin: 0 0 0.5rem;
  padding: 0.5rem 0.625rem;
  overflow-x: auto;
  background: var(--gts-surface-3);
  border: 1px solid var(--gts-line);
  border-radius: var(--gts-radius);
}
.gtsai-md :deep(pre code) { background: none; padding: 0; }
.gtsai-md :deep(blockquote) {
  margin: 0 0 0.5rem;
  padding-left: 0.625rem;
  border-left: 2px solid var(--gts-line-strong);
  color: var(--gts-ink-2);
}

/* Подсветка синтаксиса — на семантических токенах темы, а не на палитре
   highlight.js: её хексы светятся поверх тёмной схемы, да и правило проекта
   прямое — своих цветов не держим. */
.gtsai-md :deep(.hljs-keyword),
.gtsai-md :deep(.hljs-built_in),
.gtsai-md :deep(.hljs-literal) { color: var(--gts-accent); }
.gtsai-md :deep(.hljs-string),
.gtsai-md :deep(.hljs-regexp) { color: var(--gts-ok); }
.gtsai-md :deep(.hljs-number) { color: var(--gts-warn); }
.gtsai-md :deep(.hljs-comment) { color: var(--gts-ink-3); font-style: italic; }
.gtsai-md :deep(.hljs-title),
.gtsai-md :deep(.hljs-function .hljs-title),
.gtsai-md :deep(.hljs-section) { color: var(--gts-info); }
.gtsai-md :deep(.hljs-variable),
.gtsai-md :deep(.hljs-attr),
.gtsai-md :deep(.hljs-attribute) { color: var(--gts-ink-2); }
.gtsai-md :deep(.hljs-deletion) { color: var(--gts-danger); }
.gtsai-md :deep(.hljs-addition) { color: var(--gts-ok); }

.gtsai-card {
  border: 1px solid var(--gts-line-strong);
  border-radius: var(--gts-radius);
  background: var(--gts-surface-2);
  padding: 0.5rem 0.625rem;
}
.gtsai-card-head { font-weight: var(--gts-weight-med); margin-bottom: 0.25rem; }
.gtsai-card-reason { color: var(--gts-ink-2); margin-bottom: 0.375rem; }
.gtsai-card-state { color: var(--gts-ink-3); font-size: var(--gts-size-sm); align-self: center; }
.gtsai-card-foot { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.gtsai-diff { width: 100%; font-size: var(--gts-size-sm); border-collapse: collapse; }
.gtsai-diff td { padding: 0.125rem 0.25rem; vertical-align: top; border-top: 1px solid var(--gts-line); }
.gtsai-diff-id { color: var(--gts-ink-3); white-space: nowrap; }
.gtsai-diff s { color: var(--gts-ink-3); }

.gtsai-error {
  color: var(--gts-danger);
  background: var(--gts-danger-soft);
  border-radius: var(--gts-radius);
  padding: 0.5rem 0.625rem;
}
/* Ввод: одна рамка на поле и его кнопки. */
.gtsai-box {
  margin: 0.625rem;
  padding: 0.5rem 0.5rem 0.375rem;
  background: var(--gts-surface);
  border: 1px solid var(--gts-field-border);
  border-radius: var(--gts-radius-l);
  transition: border-color var(--gts-duration), box-shadow var(--gts-duration);
}
/* Рамка подсвечивается, пока пишут, — как у полей системы. */
.gtsai-box:focus-within {
  border-color: var(--gts-field-border-focus);
  box-shadow: var(--gts-field-ring);
}
.gtsai-box textarea {
  display: block;
  width: 100%;
  min-height: 1.5rem;
  max-height: 11rem;
  resize: none;
  background: none;
  color: var(--gts-ink);
  border: 0;
  outline: none;
  padding: 0.125rem 0.125rem 0.375rem;
  font: inherit;
  line-height: var(--gts-leading);
}
.gtsai-box textarea::placeholder { color: var(--gts-ink-3); }
.gtsai-box--drop { border-color: var(--gts-accent); }
.gtsai-files { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.375rem; }
.gtsai-file {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
  padding: 0.125rem 0.375rem;
  border-radius: var(--gts-radius-s);
  background: var(--gts-surface-2);
  color: var(--gts-ink-2);
  font-size: var(--gts-size-sm);
}
.gtsai-file-size { color: var(--gts-ink-3); }
.gtsai-file-x {
  border: 0;
  background: none;
  color: var(--gts-ink-3);
  cursor: pointer;
  line-height: 1;
  padding: 0;
}
.gtsai-file-x:hover { color: var(--gts-danger); }
.gtsai-attach {
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gts-line-strong);
  border-radius: var(--gts-radius-s);
  background: transparent;
  color: var(--gts-ink-2);
  cursor: pointer;
  line-height: 1;
}
.gtsai-attach:hover { background: var(--gts-surface-2); color: var(--gts-ink); }
.gtsai-attach:disabled { opacity: 0.5; cursor: default; }
.gtsai-box-foot { display: flex; align-items: center; gap: 0.375rem; }
.gtsai-box-spacer { flex: 1; }
/* Модель и прочие пометки — спокойным тоном: это подпись, а не действие. */
.gtsai-chip {
  display: inline-flex;
  align-items: center;
  height: 1.5rem;
  padding: 0 0.5rem;
  border-radius: var(--gts-radius-l);
  background: var(--gts-surface-2);
  color: var(--gts-ink-3);
  font-size: var(--gts-size-sm);
  white-space: nowrap;
}
.gtsai-chip--btn { border: 0; cursor: pointer; }
/* Выбор модели выглядит той же плашкой: это подпись, которая умеет меняться,
   а не ещё одна кнопка в строке. */
.gtsai-chip--select {
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
  font-size: var(--gts-size-sm);
  max-width: 11rem;
}
.gtsai-chip--select:hover { border-color: var(--gts-line-strong); color: var(--gts-ink-2); }
.gtsai-chip--btn:hover { background: var(--gts-surface-3); color: var(--gts-ink-2); }
/* Режим «сразу» заметен: это состояние, в котором правки уходят без вопроса. */
.gtsai-chip--on {
  background: var(--gts-warn-soft, var(--gts-accent-soft));
  color: var(--gts-ink);
}
.gtsai-chip--btn:disabled { opacity: 0.6; cursor: default; }
.gtsai-send {
  width: 1.75rem;
  height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--gts-radius-s);
  background: var(--gts-accent);
  color: var(--gts-accent-contrast);
  cursor: pointer;
  font-size: var(--gts-size-base);
  line-height: 1;
}
.gtsai-send:hover { background: var(--gts-accent-hover); }
.gtsai-send:disabled { opacity: 0.45; cursor: default; }
.gtsai-send--stop { background: var(--gts-danger); }
.gtsai-btn {
  height: var(--gts-control-h);
  padding: 0 0.875rem;
  border: 1px solid transparent;
  border-radius: var(--gts-radius);
  background: var(--gts-accent);
  color: var(--gts-accent-contrast);
  cursor: pointer;
}
.gtsai-btn:hover { background: var(--gts-accent-hover); }
.gtsai-btn:disabled { opacity: 0.6; cursor: default; }
.gtsai-secondary {
  background: transparent;
  color: var(--gts-ink-2);
  border-color: var(--gts-line-strong);
}
.gtsai-stop { background: var(--gts-danger); }
</style>
