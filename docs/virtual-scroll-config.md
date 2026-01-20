# Настройка виртуального скроллинга из конфига таблицы

## Описание

Добавлена возможность включать виртуальный скроллинг автоматически из конфигурации таблицы на сервере.

## Изменения

### Backend (TableFieldsTrait.php)

В метод `options()` добавлена отправка параметра `enable_virt_scroll` на фронтенд:

```php
if (isset($rule['properties']['enable_virt_scroll'])) {
    $options['enable_virt_scroll'] = $rule['properties']['enable_virt_scroll'];
}
```

### Frontend (PVTables.vue)

1. Добавлена переменная для хранения настройки из конфига:
```javascript
const enableVirtScroll = ref(false)
```

2. Обработка ответа от API:
```javascript
if (response.data.hasOwnProperty("enable_virt_scroll")) {
  enableVirtScroll.value = response.data.enable_virt_scroll;
}
```

3. Передача настройки в composable:
```javascript
const { ... } = useVirtualScroll({
  columns,
  lineItems,
  dt,
  storageKey: `pvtables-virtual-scroll-${props.table}`,
  enableVirtScroll  // Новый параметр
});
```

### Composable (useVirtualScroll.js)

1. Добавлен параметр `enableVirtScroll` в функцию
2. Изменена логика загрузки настроек:
   - Если в localStorage есть явное отключение (`enabled: false`), оно имеет приоритет
   - Если в localStorage нет настроек или не отключено явно, используется настройка из конфига
   - Если в конфиге `enable_virt_scroll = true`, виртуальный скроллинг включается автоматически

3. Добавлен watch для отслеживания изменений настройки из конфига:
   - Если пользователь не отключал виртуальный скроллинг вручную
   - И в конфиге включена настройка
   - То виртуальный скроллинг включается автоматически

## Использование

### Настройка на сервере

В конфигурации таблицы добавьте параметр:

```php
$rule['properties']['enable_virt_scroll'] = true; // или false
```

### Приоритет настроек

1. **Высший приоритет**: Явное отключение пользователем в браузере (localStorage)
2. **Средний приоритет**: Настройка из конфига таблицы (`enable_virt_scroll`)
3. **Низший приоритет**: Значение по умолчанию (false)

### Примеры

#### Пример 1: Включение виртуального скроллинга для большой таблицы

```php
// В конфигурации таблицы
$rule['properties']['enable_virt_scroll'] = true;
```

При первой загрузке таблицы виртуальный скроллинг будет включен автоматически.

#### Пример 2: Пользователь отключил виртуальный скроллинг

Если пользователь вручную отключил виртуальный скроллинг через UI:
- Настройка сохраняется в localStorage
- При следующей загрузке виртуальный скроллинг останется выключенным
- Даже если в конфиге `enable_virt_scroll = true`

#### Пример 3: Сброс настроек

Чтобы сбросить настройки пользователя и применить конфиг:
```javascript
// Очистить localStorage для конкретной таблицы
localStorage.removeItem('pvtables-virtual-scroll-table_name');
// Перезагрузить страницу
```

## Технические детали

### Структура данных в localStorage

```json
{
  "enabled": true,
  "rowHeight": 50
}
```

### Логика определения состояния

```javascript
if (settings.enabled === false) {
  // Пользователь явно отключил - уважаем его выбор
  virtualScrollEnabled.value = false;
} else if (enableVirtScroll && enableVirtScroll.value) {
  // Конфиг включен - включаем
  virtualScrollEnabled.value = true;
} else {
  // Используем сохраненное значение или false по умолчанию
  virtualScrollEnabled.value = settings.enabled !== undefined ? settings.enabled : false;
}
```

## Совместимость

- Обратная совместимость: Если `enable_virt_scroll` не указан в конфиге, поведение остается прежним
- Существующие настройки пользователей в localStorage сохраняются и имеют приоритет
