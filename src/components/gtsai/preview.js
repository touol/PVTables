// Предпросмотр markdown для чата: готовый MdPreview из md-editor-v3.
//
// Почему готовый пакет, а не своя сборка из marked+hljs: в чате нужен не только
// разбор разметки — нужны кнопка копирования у блоков кода, подсветка, таблицы,
// HTML, формулы и диаграммы. Собирать это руками дольше и хуже.
//
// Лежит отдельным файлом и грузится динамическим import() — значит уедет в
// ленивый чанк (~370 КБ), а не в pvtables.js, который есть на каждой странице.
// Редактор с CodeMirror при этом не подтягивается: берём только предпросмотр.
import { MdPreview, config } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import hljs from 'highlight.js/lib/core'
import php from 'highlight.js/lib/languages/php'
import javascript from 'highlight.js/lib/languages/javascript'
import sql from 'highlight.js/lib/languages/sql'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import bash from 'highlight.js/lib/languages/bash'

hljs.registerLanguage('php', php)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('bash', bash)

config({
  // ⚠️ По умолчанию подсветка, формулы и диаграммы грузятся с unpkg. В локальной
  // сети и за периметром это просто не работает, поэтому отдаём свой экземпляр
  // highlight.js, собранный в бандл.
  editorExtensions: {
    highlight: { instance: hljs },
  },

  // Подписи интерфейса (кнопка копирования кода и подсказки) по умолчанию
  // китайские — объявляем свои.
  editorConfig: {
    languageUserDefined: {
      'ru-RU': {
        copyCode: {
          text: 'Копировать',
          successTips: 'Скопировано',
          failTips: 'Не удалось скопировать',
        },
        mermaid: {
          flow: 'схема',
          sequence: 'последовательность',
          gantt: 'Гантт',
          class: 'классы',
          state: 'состояния',
          pie: 'круговая',
          relationship: 'связи',
          journey: 'путь',
        },
      },
    },
  },

  // HTML в ответе показываем как HTML, а не текстом: модель им пользуется для
  // мелкой разметки. Безопасность остаётся на встроенном xss-фильтре пакета —
  // он режет script, обработчики on* и опасные протоколы.
  markdownItConfig(md) {
    md.set({ html: true })
  },
})

export { MdPreview }
