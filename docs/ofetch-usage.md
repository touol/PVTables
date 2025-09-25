# Использование ofetch как замены axios

## Обзор

`ofetch` - это современная, легковесная библиотека для HTTP-запросов от команды Nuxt.js. Она автоматически работает как в браузере, так и в Node.js без дополнительных настроек.

## Преимущества ofetch

### ✅ Плюсы:
- **Универсальность** - работает в браузере и Node.js из коробки
- **Легковесность** - меньший размер по сравнению с axios
- **Автоматическое определение среды** - не требует полифиллов
- **Встроенная обработка JSON** - автоматически парсит ответы
- **Retry логика** - встроенная поддержка повторных запросов
- **TypeScript поддержка** - полная типизация

### ⚠️ Особенности:
- Автоматически парсит JSON ответы
- Бросает исключения для HTTP ошибок (4xx, 5xx)
- Поддерживает interceptors через хуки

## Сравнение с axios

| Функция | axios | ofetch |
|---------|-------|--------|
| Размер бандла | ~33KB | ~8KB |
| SSR поддержка | Требует настройки | Из коробки |
| JSON парсинг | Ручной | Автоматический |
| Interceptors | Да | Через хуки |
| TypeScript | Частично | Полная |

## Использование в проекте

### Импорт

```javascript
import apiFetch from './components/api-ofetch.js';

// Использование
const api = apiFetch('tableName');
const data = await api.read();
```

### Основные методы

```javascript
// Создание записи
const newRecord = await api.create({
  name: 'Test',
  value: 123
});

// Чтение записей
const records = await api.read({
  limit: 10,
  offset: 0
});

// Получение одной записи
const record = await api.get(123);

// Обновление записи
const updated = await api.update({
  id: 123,
  name: 'Updated'
});

// Удаление записи
await api.delete({ id: 123 });

// Автокомплит
const suggestions = await api.autocomplete({
  query: 'test'
});

// Кастомные действия
const result = await api.action('customAction', {
  param1: 'value1'
});
```

## Конфигурация

### Базовые настройки

```javascript
const $fetch = ofetch.create({
  baseURL: '/api/tableName',
  timeout: 60000,
  retry: 1,
  
  // Хуки для обработки ошибок
  onRequestError({ error }) {
    console.error('Request error:', error);
  },
  
  onResponseError({ response }) {
    console.error('Response error:', response.status);
  }
});
```

### SSR конфигурация

ofetch автоматически определяет среду выполнения:

```javascript
// В браузере - использует fetch
// В Node.js - использует встроенный HTTP клиент

// Настройка базового URL для SSR
if (typeof window === 'undefined') {
  if (typeof globalThis.SSR_BASE_URL !== 'undefined') {
    baseURL = globalThis.SSR_BASE_URL;
  }
}
```

## Обработка ошибок

### Автоматическая обработка

```javascript
// ofetch автоматически бросает исключения для HTTP ошибок
try {
  const data = await api.read();
} catch (error) {
  // Ошибка автоматически обработана через useNotifications
  console.error('API Error:', error.message);
}
```

### Кастомная обработка

```javascript
const $fetch = ofetch.create({
  onResponseError({ response, error }) {
    // Кастомная логика обработки ошибок
    if (response.status === 401) {
      // Перенаправление на логин
      window.location.href = '/login';
    }
  }
});
```

## Миграция с axios

### Было (axios):
```javascript
import axios from 'axios';

const instance = axios.create({
  baseURL: '/api/users',
  timeout: 60000
});

const response = await instance.get('/', { params: { limit: 10 } });
const data = response.data;
```

### Стало (ofetch):
```javascript
import apiFetch from './components/api-ofetch.js';

const api = apiFetch('users');
const data = await api.read({ limit: 10 });
```

## Производительность

### Размер бандла
- **axios**: ~33KB (минифицированный)
- **ofetch**: ~8KB (минифицированный)
- **Экономия**: ~75% размера

### Время загрузки
- Меньший размер = быстрее загрузка
- Нативная поддержка SSR = лучшая производительность сервера

## Совместимость

### Браузеры
- Chrome 42+
- Firefox 39+
- Safari 10.1+
- Edge 14+

### Node.js
- Node.js 14+
- Автоматическая поддержка без дополнительных зависимостей

## Заключение

ofetch предоставляет современное, эффективное решение для HTTP-запросов с отличной поддержкой SSR и минимальными накладными расходами. Это отличная замена axios для современных проектов.

### Рекомендации:
1. **Используйте ofetch** для новых проектов
2. **Мигрируйте с axios** для уменьшения размера бандла
3. **Настройте обработку ошибок** под ваши нужды
4. **Используйте TypeScript** для лучшей типизации
