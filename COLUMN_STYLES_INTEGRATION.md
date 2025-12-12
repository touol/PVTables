# Интеграция сохранения стилей колонок

## Бэкенд (gtsAPI)

### 1. Добавлено поле в схему БД
Файл: `V:\OSPanel\home\modx28.loc\public\Extras\gtsAPI\core\components\gtsapi\model\schema\gtsapi.mysql.schema.xml`

Добавлено поле в объект `gtsAPITable`:
```xml
<field key="fields_style" dbtype="text" phptype="string" null="true"/>
```

**Нужно выполнить:** Пересоздать модель и обновить БД через пакет gtsAPI.

### 2. Изменения в table.class.php

Файл: `V:\OSPanel\home\modx28.loc\public\Extras\gtsAPI\core\components\gtsapi\api_controllers\table.class.php`

#### 2.1. В методе `options()` добавить отправку стилей

Найти строку (примерно 1050):
```php
$options = [
    'fields'=>$fields,
    'actions'=>$actions,
    'selects'=>$selects,
    'filters'=>$filters,
    'row_class_trigger'=>$row_class_trigger,
    'table_tree'=>$table_tree,
    'limit'=>$limit,
];
```

Добавить ПЕРЕД `return $this->success('options',$options);`:
```php
// Отправка стилей полей с сервера
if($gtsAPITable = $this->modx->getObject('gtsAPITable',['table'=>$rule['table'],'active'=>1])){
    if($gtsAPITable->fields_style){
        $options['fields_style'] = json_decode($gtsAPITable->fields_style, true);
    }
}
```

#### 2.2. В методе `route_post()` добавить обработку новых действий

Найти блок switch с `case 'print':` (примерно строка 250) и добавить ПЕРЕД `default:`:
```php
case 'save_fields_style':
    return $this->save_fields_style($rule,$request);
break;
case 'reset_fields_style':
    return $this->reset_fields_style($rule,$request);
break;
```

#### 2.3. Добавить новые методы в конец класса (перед закрывающей фигурной скобкой)

```php
/**
 * Сохранение стилей колонок на сервере
 * Доступно только для группы Administrator
 */
public function save_fields_style($rule, $request) {
    // Проверка прав доступа - только Administrator
    if (!$this->modx->user->isMember('Administrator')) {
        return $this->error('Доступ запрещен. Требуются права администратора.');
    }
    
    if (empty($request['fields_style'])) {
        return $this->error('Не переданы стили полей');
    }
    
    // Получаем объект таблицы
    if (!$gtsAPITable = $this->modx->getObject('gtsAPITable', ['table' => $rule['table'], 'active' => 1])) {
        return $this->error('Таблица не найдена');
    }
    
    // Сохраняем стили как JSON
    $gtsAPITable->set('fields_style', json_encode($request['fields_style']));
    
    if ($gtsAPITable->save()) {
        return $this->success('Стили полей сохранены', [
            'fields_style' => $request['fields_style']
        ]);
    }
    
    return $this->error('Ошибка сохранения стилей');
}

/**
 * Сброс стилей колонок на сервере
 * Доступно только для группы Administrator
 */
public function reset_fields_style($rule, $request) {
    // Проверка прав доступа - только Administrator
    if (!$this->modx->user->isMember('Administrator')) {
        return $this->error('Доступ запрещен. Требуются права администратора.');
    }
    
    // Получаем объект таблицы
    if (!$gtsAPITable = $this->modx->getObject('gtsAPITable', ['table' => $rule['table'], 'active' => 1])) {
        return $this->error('Таблица не найдена');
    }
    
    // Очищаем стили
    $gtsAPITable->set('fields_style', null);
    
    if ($gtsAPITable->save()) {
        return $this->success('Стили полей сброшены', [
            'fields_style' => null
        ]);
    }
    
    return $this->error('Ошибка сброса стилей');
}
```

## Фронтенд (PVTables)

### 1. Добавить обработку column-resize-end в PVTables.vue

В template DataTable добавить событие:
```vue
<DataTable
  ...
  @column-resize-end="onColumnResizeEnd"
>
```

### 2. Добавить методы в script setup

```javascript
// Сохранение стилей колонок
const serverFieldsStyle = ref(null);

// Обработчик изменения размера колонки
const onColumnResizeEnd = (event) => {
  if (!dt.value || !dt.value.$refs.table) return;
  
  const headers = dt.value.$refs.table.querySelectorAll('thead th');
  const widths = {};
  
  headers.forEach((header, index) => {
    const field = columns.value[index]?.field;
    if (field) {
      widths[field] = {
        width: `${header.offsetWidth}px`,
        maxWidth: `${header.offsetWidth}px`
      };
    }
  });
  
  // Сохраняем в localStorage
  localStorage.setItem(`pvtables-${props.table}-column-widths`, JSON.stringify(widths));
};

// Сохранение стилей на сервере
const saveFieldsStyleToServer = async () => {
  const localStyles = localStorage.getItem(`pvtables-${props.table}-column-widths`);
  if (!localStyles) {
    notify('warning', { detail: 'Нет локальных стилей для сохранения' });
    return;
  }
  
  try {
    const response = await api.post('save_fields_style', {
      fields_style: JSON.parse(localStyles)
    });
    
    if (response.data.success) {
      serverFieldsStyle.value = JSON.parse(localStyles);
      notify('success', { detail: 'Стили сохранены на сервере' });
    } else {
      notify('error', { detail: response.data.message });
    }
  } catch (error) {
    notify('error', { detail: 'Ошибка сохранения стилей' });
  }
};

// Сброс локальных стилей
const resetLocalFieldsStyle = () => {
  localStorage.removeItem(`pvtables-${props.table}-column-widths`);
  notify('success', { detail: 'Локальные стили сброшены' });
  refresh(false);
};

// Сброс стилей на сервере
const resetServerFieldsStyle = async () => {
  try {
    const response = await api.post('reset_fields_style', {});
    
    if (response.data.success) {
      serverFieldsStyle.value = null;
      notify('success', { detail: 'Стили на сервере сброшены' });
      refresh(false);
    } else {
      notify('error', { detail: response.data.message });
    }
  } catch (error) {
    notify('error', { detail: 'Ошибка сброса стилей' });
  }
};

// Применение стилей при загрузке
const applyColumnWidths = () => {
  // Приоритет: локальные → серверные → дефолтные
  const localStyles = localStorage.getItem(`pvtables-${props.table}-column-widths`);
  
  let stylesToApply = null;
  
  if (localStyles) {
    stylesToApply = JSON.parse(localStyles);
  } else if (serverFieldsStyle.value) {
    stylesToApply = serverFieldsStyle.value;
  }
  
  if (stylesToApply) {
    columns.value.forEach(col => {
      if (stylesToApply[col.field]) {
        col.width = stylesToApply[col.field].width;
        col.maxWidth = stylesToApply[col.field].maxWidth;
      }
    });
  }
};

// В onMounted после получения options добавить:
if (response.data.fields_style) {
  serverFieldsStyle.value = response.data.fields_style;
}
applyColumnWidths();
```

### 3. Добавить кнопки в Popover

В template найти:
```vue
<Popover ref="op">
  <MultiSelect .../>
</Popover>
```

Заменить на:
```vue
<Popover ref="op">
  <div style="padding: 1rem;">
    <MultiSelect :modelValue="selectedColumns" :options="columns" optionLabel="label" 
      @update:modelValue="(val) => onToggleColomns(val)"
      placeholder="Выберете столбцы" :maxSelectedLabels="3"/>
    
    <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
      <Button label="Сбросить локальные стили" icon="pi pi-refresh" 
        @click="resetLocalFieldsStyle" size="small" severity="secondary"/>
      <Button label="Сбросить стили на сервере" icon="pi pi-server" 
        @click="resetServerFieldsStyle" size="small" severity="warning"/>
      <Button label="Сохранить стили на сервере" icon="pi pi-save" 
        @click="saveFieldsStyleToServer" size="small" severity="success"/>
    </div>
  </div>
</Popover>
```

## SQL для добавления поля в БД (если не пересоздавать модель)

```sql
ALTER TABLE `gtsapi_tables` ADD COLUMN `fields_style` TEXT NULL AFTER `autocomplete_field`;
```

## Тестирование

1. Измените ширину колонки мышкой
2. Обновите страницу - ширина должна сохраниться (localStorage)
3. Нажмите "Сохранить стили на сервере"
4. Очистите localStorage и обновите - стили должны загрузиться с сервера
5. Нажмите "Сбросить локальные стили" - вернутся серверные
6. Нажмите "Сбросить стили на сервере" - вернутся дефолтные
