# Использование компонентов для работы с файлами

В данной инструкции описано, как использовать компоненты `FileTree` и `FileContent` для работы с файлами в проекте.

## Компоненты

### FileTree

Компонент для отображения дерева файлов и директорий с использованием SlVueTreeNext.

**Возможности:**
- Просмотр структуры файлов и директорий
- Раскрытие/сворачивание директорий
- Фильтрация файлов по имени
- Показ/скрытие скрытых файлов
- Скачивание файлов
- При клике на файл отправляет событие select-file с информацией о файле и его содержимом

**Пропсы:**
- `mediaSource` (Number): ID источника медиа (по умолчанию: 1)
- `initialPath` (String): Начальный путь для отображения (по умолчанию: '/')

**События:**
- `select-file`: Срабатывает при клике на файл, передает объект с информацией о файле и его содержимым

**Методы:**
- `refresh()`: Обновляет дерево файлов
- `getFileContent(path)`: Получает содержимое файла по указанному пути

### FileContent

Компонент для отображения и редактирования содержимого файлов.

**Возможности:**
- Отображение информации о файле (имя, размер, дата изменения)
- Показ превью для изображений
- Отображение текстового содержимого для текстовых файлов
- Редактирование текстовых файлов с возможностью сохранения изменений
- Кнопки для скачивания и копирования содержимого

**Пропсы:**
- `file` (Object): Объект с информацией о файле
- `content` (String): Содержимое файла
- `mime` (String): MIME-тип файла
- `mediaSource` (Number): ID источника медиа (по умолчанию: 1)

**Методы:**
- `refresh()`: Обновляет содержимое файла
- `getFileContent()`: Получает содержимое файла по указанному пути

## Интеграция с UniTreePanel

Компоненты `FileTree` и `FileContent` интегрированы в существующую структуру через `PVTabs` и `UniTreePanel`.

### Использование в PVTabs

В компоненте `PVTabs` добавлена поддержка типов вкладок 'filetree' и 'filecontent':

```javascript
// Пример конфигурации вкладки с FileTree
const tabs = {
  files: {
    type: 'filetree',
    title: 'Файлы',
    mediaSource: 1,
    initialPath: '/'
  }
};

// Пример конфигурации вкладки с FileContent
const tabs = {
  content: {
    type: 'filecontent',
    title: 'Содержимое',
    file: fileObject,
    content: fileContent,
    mime: fileMime,
    mediaSource: 1
  }
};
```

### Использование в UniTreePanel

В компоненте `UniTreePanel` добавлен обработчик события `select-file`, который создает вкладку с содержимым файла в правой панели.

**Пример использования:**

```javascript
// Конфигурация treetabs с типом 'filetree'
const fileTreeTabs = {
  files: {
    type: 'filetree',
    title: 'Файлы',
    mediaSource: 1,
    initialPath: '/'
  }
};

// Использование в шаблоне
<UniTreePanel :treetabs="fileTreeTabs" :mediaSource="1" />
```

## Пример полного использования

```vue
<template>
  <div class="file-explorer">
    <UniTreePanel :treetabs="fileTreeTabs" :mediaSource="1" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import UniTreePanel from './components/UniTreePanel.vue';

const fileTreeTabs = ref({
  files: {
    type: 'filetree',
    title: 'Файлы',
    mediaSource: 1,
    initialPath: '/'
  }
});
</script>
```

## Требования к API

Для корректной работы компонентов необходимо, чтобы API поддерживало следующие методы:

1. **GET /api/files** - получение списка файлов и директорий
   - Параметры: `path`, `source`
   - Ответ: `{ success: 1, message: '', data: { files: [], directories: [] } }`

2. **GET /api/files** с параметром `action=content` - получение содержимого файла
   - Параметры: `action=content`, `path`, `source`
   - Ответ: `{ success: 1, message: '', data: { content: '', mime: '' } }`

3. **GET /api/files** с параметром `action=download` - скачивание файла
   - Параметры: `action=download`, `path`, `source`
   - Ответ: бинарные данные файла

4. **POST /api/files** с параметром `action=upload` - загрузка файла
   - Параметры: `action=upload`, `file`, `path`, `source`
   - Ответ: `{ success: 1, message: '' }`

5. **POST /api/files** с параметром `action=directory` - создание директории
   - Параметры: `action=directory`, `path`, `name`, `source`
   - Ответ: `{ success: 1, message: '' }`

6. **POST /api/files** с параметром `action=rename` - переименование файла или директории
   - Параметры: `action=rename`, `path`, `newName`, `source`
   - Ответ: `{ success: 1, message: '' }`

7. **POST /api/files** с параметром `action=remove` - удаление файла или директории
   - Параметры: `action=remove`, `path`, `source`
   - Ответ: `{ success: 1, message: '' }`

8. **POST /api/files** с параметром `action=save` - сохранение содержимого файла
   - Параметры: `action=save`, `path`, `content`, `source`
   - Ответ: `{ success: 1, message: '' }`
