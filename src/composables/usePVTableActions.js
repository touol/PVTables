import { markRaw } from 'vue';
import { compile } from 'vue';

/**
 * Composable для управления действиями таблицы
 * @param {Object} params - Параметры
 * @param {Object} params.api - API объект
 * @param {Object} params.props - Пропсы компонента
 * @param {Function} params.prepFilters - Функция подготовки фильтров
 * @param {Function} params.refresh - Функция обновления таблицы
 * @param {Function} params.notify - Функция уведомлений
 * @param {Object} params.emit - Функция emit
 * @param {Ref} params.dataFields - Поля данных
 * @param {Ref} params.selectedlineItems - Выбранные строки
 * @param {Ref} params.table_tree - Настройки дерева таблицы
 * @param {Ref} params.filters - Фильтры
 * @param {Ref} params.modalFormDialog - Ref для диалога модальной формы
 * @param {Ref} params.modalFormData - Ref для данных модальной формы
 * @param {Ref} params.modalFormAction - Ref для действия модальной формы
 * @param {Ref} params.modalFormRowData - Ref для данных строки модальной формы
 * @param {Ref} params.modalFormType - Ref для типа модальной формы
 * @param {Ref} params.modalFormColumns - Ref для колонок модальной формы
 * @returns {Object} Объект с функциями действий
 */
export function usePVTableActions({
  api,
  props,
  prepFilters,
  refresh,
  notify,
  emit,
  dataFields,
  selectedlineItems,
  table_tree,
  filters,
  modalFormDialog,
  modalFormData,
  modalFormAction,
  modalFormRowData,
  modalFormType,
  modalFormColumns
}) {
  
  /**
   * Валидация шаблона на предмет безопасности
   * @param {String} template - Шаблон для валидации
   * @returns {Boolean} true если шаблон безопасен
   */
  const validateTemplate = (template) => {
    if (!template || typeof template !== 'string') return true;
    
    // Запрещенные паттерны для безопасности
    const forbiddenPatterns = [
      /\$parent/gi,
      /\$root/gi,
      /document\./gi,
      /window\./gi,
      /eval\(/gi,
      /<script/gi,
      /javascript:/gi,
      /constructor\.constructor/gi,
      /__proto__/gi,
      /localStorage/gi,
      /sessionStorage/gi,
      /fetch\(/gi,
      /XMLHttpRequest/gi,
      /WebSocket/gi,
      /setTimeout/gi,
      /setInterval/gi,
      /import\(/gi,
      /require\(/gi,
      /process\./gi,
      /global\./gi
    ];
    
    // Проверяем на наличие запрещенных паттернов
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(template)) {
        console.warn(`Обнаружен потенциально опасный паттерн в шаблоне: ${pattern}`);
        return false;
      }
    }
    
    return true;
  };

  /**
   * Компиляция кастомного шаблона для действий
   * @param {String} template - Шаблон для компиляции
   * @returns {Object|null} Скомпилированный компонент или null
   */
  const compileActionTemplate = (template) => {
    if (!template) return null;
    
    // Валидация шаблона перед компиляцией
    if (!validateTemplate(template)) {
      console.error('Шаблон содержит потенциально опасные конструкции');
      notify('error', { detail: 'Шаблон содержит потенциально опасные конструкции и не может быть использован' });
      return null;
    }
    
    try {
      const compiledRender = compile(template);
      
      // Создаем компонент с правильным контекстом и оборачиваем в markRaw
      // для предотвращения реактивности и улучшения производительности
      return markRaw({
        render: compiledRender,
        props: ['data', 'columns', 'table', 'filters', 'action'],
        emits: ['action-click'],
        setup(props, { emit }) {
          // Предоставляем методы и переменные для шаблона
          return {
            // Предоставляем доступ к emit под безопасным именем
            emitEvent: emit,
            // Добавляем другие методы, которые могут понадобиться в шаблоне
            executeAction: () => {
              emit('action-click');
            }
          };
        }
      });
    } catch (error) {
      console.error('Ошибка компиляции шаблона действия:', error);
      notify('error', { detail: `Ошибка в шаблоне действия: ${error.message}` });
      return null;
    }
  };

  /**
   * Обработка действий из API
   * @param {Object} actions0 - Объект действий из API
   * @param {Object} propsActions - Действия из props
   * @param {Object} callbacks - Колбэки для действий
   * @returns {Object} Обработанные действия
   */
  const processActions = (actions0, propsActions, callbacks) => {
    const {
      editLineItem,
      confirmDeleteLineItem,
      confirmDeleteSelected,
      openNew,
      setExpandedRow
    } = callbacks;

    const cur_actions = [];
    const nemu_actions = {};
    let actions_row = false;
    let SpeedDialEnabled = false;

    // Объединяем действия из API и props
    if (propsActions.hasOwnProperty(props.table)) {
      for (let action in propsActions[props.table]) {
        actions0[action] = propsActions[props.table][action];
      }
    }

    // Обрабатываем каждое действие
    for (let action in actions0) {
      let tmp = { ...actions0[action] };
      let addtmp = true;
      
      switch (action) {
        case "update":
          tmp.action = action;
          if (!tmp.hasOwnProperty("row")) tmp.row = true;
          if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-pencil";
          if (!tmp.hasOwnProperty("class")) tmp.class = " p-button-success";
          if (!tmp.hasOwnProperty("click")) tmp.click = (data) => editLineItem(data, tmp);
          break;
          
        case "delete":
          if (!tmp.hasOwnProperty("row")) tmp.row = true;
          if (!tmp.hasOwnProperty("head")) tmp.head = true;
          if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-trash";
          if (!tmp.hasOwnProperty("class")) tmp.class = " p-button-danger";
          if (!tmp.hasOwnProperty("click")) tmp.click = (data) => confirmDeleteLineItem(data);
          if (!tmp.hasOwnProperty("head_click")) tmp.head_click = () => confirmDeleteSelected();
          if (!tmp.hasOwnProperty("label")) tmp.label = "Удалить";
          break;
          
        case "create":
          tmp.action = action;
          if (!tmp.hasOwnProperty("head")) tmp.head = true;
          if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-plus";
          if (!tmp.hasOwnProperty("class")) tmp.class = " p-button-success";
          if (!tmp.hasOwnProperty("head_click")) tmp.head_click = () => openNew(tmp);
          if (!tmp.hasOwnProperty("label")) tmp.label = "Создать";
          break;
          
        case "insert":
          if (!tmp.hasOwnProperty("head")) tmp.head = true;
          if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-plus";
          if (!tmp.hasOwnProperty("class")) tmp.class = " p-button-success";
          if (!tmp.hasOwnProperty("head_click")) tmp.head_click = () => Insert();
          if (!tmp.hasOwnProperty("label")) tmp.label = "Вставить";
          // Добавляем обработчик клавиатуры
          document.addEventListener('keyup', function(e) {
            if (!e.ctrlKey || !e.shiftKey || e.code !== 'KeyZ') return;
            Insert();
          }, true);
          break;
          
        case "insert_child":
          if (!tmp.hasOwnProperty("row")) tmp.row = true;
          if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-plus";
          if (!tmp.hasOwnProperty("class")) tmp.class = " p-button-success";
          if (!tmp.hasOwnProperty("click")) tmp.click = (data) => Insert_child(data);
          if (!tmp.hasOwnProperty("label")) tmp.label = "Вставить";
          break;
          
        case "subtables":
          addtmp = false;
          for (let tmptable in actions0[action]) {
            let tmpt = { action: action, ...actions0[action][tmptable] };
            tmpt.table = tmptable;
            if (!tmpt.hasOwnProperty("row")) tmpt.row = true;
            if (!tmpt.hasOwnProperty("icon")) tmpt.icon = "pi pi-angle-right";
            if (!tmpt.hasOwnProperty("class")) tmpt.class = " p-button-success";
            if (!tmpt.hasOwnProperty("click")) tmpt.click = (event) => setExpandedRow(event, tmpt);
            actions_row = true;
            cur_actions.push(tmpt);
          }
          break;
          
        case "subtabs":
          addtmp = false;
          for (let tmptable in actions0[action]) {
            let tmpt = { action: action, tabs: { ...actions0[action][tmptable] } };
            tmpt.table = tmptable;
            if (!tmpt.hasOwnProperty("row")) tmpt.row = true;
            if (!tmpt.hasOwnProperty("icon")) tmpt.icon = "pi pi-angle-right";
            if (!tmpt.hasOwnProperty("class")) tmpt.class = " p-button-success";
            if (!tmpt.hasOwnProperty("click")) tmpt.click = (event) => setExpandedRow(event, tmpt);
            actions_row = true;
            cur_actions.push(tmpt);
          }
          break;
          
        case "read":
          break;
          
        case "excel_export":
          if (!tmp.hasOwnProperty("head")) tmp.head = true;
          if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-file-excel";
          if (!tmp.hasOwnProperty("class")) tmp.class = " p-button-success";
          if (!tmp.hasOwnProperty("head_click")) tmp.head_click = () => excelExport(tmp);
          if (!tmp.hasOwnProperty("label")) tmp.label = "Excel";
          break;
          
        case "print":
          addtmp = false;
          break;
          
        default:
          if (!tmp.hasOwnProperty("class")) tmp.class = " p-button-success";
          if (!(tmp.head_click || tmp.click)) {
            if (tmp.head) tmp.head_click = () => defHeadAction(tmp);
            if (tmp.row) tmp.click = (event) => defRowAction(event, tmp);
          }
      }
      
      if (!tmp.action) tmp.action = action;
      
      // Обработка меню
      if (tmp.hasOwnProperty("menu") && tmp.menu == 1) {
        SpeedDialEnabled = true;
        nemu_actions[action] = tmp;
      }
      
      // Компилируем template_row если он есть
      if (tmp.template_row) {
        tmp.compiledTemplate = compileActionTemplate(tmp.template_row);
      }
      
      if (addtmp) {
        if (tmp.hasOwnProperty("row")) actions_row = true;
        cur_actions.push(tmp);
      }
    }

    return {
      cur_actions,
      nemu_actions,
      actions_row,
      SpeedDialEnabled
    };
  };
  
  /**
   * Получение значений data_fields из строки данных
   * @param {Object} data - Данные строки
   * @returns {Object} Объект с значениями data_fields
   */
  const getDataFieldsValues = (data) => {
    if (!dataFields.value || dataFields.value.length === 0) {
      return {}
    }
    let result = {}
    dataFields.value.forEach(field => {
      if (data.hasOwnProperty(field)) {
        result[field] = data[field]
      }
    })
    return result
  }

  /**
   * Показать модальную форму для действия
   * @param {Object} action - Объект действия
   * @param {Object} rowData - Данные строки (для row action)
   * @param {String} type - Тип действия ('head' или 'row')
   */
  const showModalForm = (action, rowData, type) => {
    modalFormAction.value = action;
    modalFormRowData.value = rowData;
    modalFormType.value = type;
    modalFormData.value = {};
    
    // Создаем колонки для формы из modal_form.fields
    modalFormColumns.value = [];
    if (action.modal_form && action.modal_form.fields) {
      for (let fieldName in action.modal_form.fields) {
        let field = { ...action.modal_form.fields[fieldName] };
        field.field = fieldName;
        if (!field.label) field.label = fieldName;
        if (!field.type) field.type = 'text';
        modalFormColumns.value.push(field);
        
        // Устанавливаем значения по умолчанию
        if (field.default !== undefined) {
          modalFormData.value[fieldName] = field.default;
        } else if (rowData && rowData[fieldName] !== undefined) {
          modalFormData.value[fieldName] = rowData[fieldName];
        }
      }
    }
    
    modalFormDialog.value = true;
  };

  /**
   * Скрыть модальную форму
   */
  const hideModalForm = () => {
    modalFormDialog.value = false;
    modalFormAction.value = null;
    modalFormRowData.value = null;
    modalFormData.value = {};
    modalFormColumns.value = [];
  };

  /**
   * Отправить данные модальной формы
   */
  const submitModalForm = async () => {
    if (!modalFormAction.value) return;
    
    let filters0 = prepFilters();
    let requestData = { ...modalFormData.value, filters: filters0 };
    
    // Добавляем данные строки если это row action
    if (modalFormType.value === 'row' && modalFormRowData.value) {
      requestData = { ...modalFormRowData.value, ...requestData };
      
      // Добавляем data_fields для текущей строки если они есть
      if (dataFields.value && dataFields.value.length > 0) {
        requestData.data_fields_values = [getDataFieldsValues(modalFormRowData.value)];
      }
    } else if (modalFormType.value === 'head') {
      // Добавляем data_fields для выбранных строк если они есть
      if (dataFields.value && dataFields.value.length > 0 && selectedlineItems.value && selectedlineItems.value.length > 0) {
        requestData.data_fields_values = selectedlineItems.value.map(item => getDataFieldsValues(item));
      } else if (selectedlineItems.value && selectedlineItems.value.length > 0) {
        // Если нет dataFields, добавляем ids выделенных строк
        requestData.ids = selectedlineItems.value.map(item => item.id).join(',');
      }
    }
    
    try {
      const resp = await api.action(modalFormAction.value.action, requestData);
      emit('get-response', {table: props.table, action: modalFormAction.value.action, response: resp});
      
      if (!resp.success) {
        notify('error', { detail: resp.message });
      } else {
        hideModalForm();
        refresh(false);
      }
    } catch (error) {
      console.log('error', error);
      notify('error', { detail: error.message });
    }
  };

  /**
   * Действие для заголовка таблицы
   * @param {Object} tmp - Объект действия
   */
  const defHeadAction = async (tmp) => {
    // Если есть modal_form, показываем форму
    if (tmp.modal_form) {
      showModalForm(tmp, null, 'head')
      return
    }
    
    let requestData = {filters: prepFilters()}
    
    // Добавляем data_fields для выбранных строк если они есть
    if (dataFields.value && dataFields.value.length > 0 && selectedlineItems.value && selectedlineItems.value.length > 0) {
      requestData.data_fields_values = selectedlineItems.value.map(item => getDataFieldsValues(item))
    }
    
    // Добавляем ids выделенных строк
    if (selectedlineItems.value && selectedlineItems.value.length > 0) {
      requestData.ids = selectedlineItems.value.map(item => item.id).join(',');
    }
    
    try {
      const resp = await api.action(tmp.action, requestData)
      if(!resp.success) notify('error', { detail: resp.message })
      refresh(false)
    } catch (error) {
      console.log('error',error)
      notify('error', { detail: error.message });
    }
  };

  /**
   * Действие для строки таблицы
   * @param {Object} event - Данные строки
   * @param {Object} tmp - Объект действия
   */
  const defRowAction = async (event, tmp) => {
    // Если есть modal_form, показываем форму
    if (tmp.modal_form) {
      showModalForm(tmp, event, 'row')
      return
    }
    
    let filters0 = prepFilters()
    
    let requestData = {...event, filters: filters0}
    
    // Добавляем data_fields для текущей строки если они есть (массив с одним объектом)
    if (dataFields.value && dataFields.value.length > 0) {
      requestData.data_fields_values = [getDataFieldsValues(event)]
    }
    
    try {
      const resp = await api.action(tmp.action, requestData)
      emit('get-response', {table:props.table,action:tmp.action,response:resp})
      if(!resp.success) notify('error', { detail: resp.message });
      refresh(false)
    } catch (error) {
      console.log('error',error)
      notify('error', { detail: error.message });
    }
  };

  /**
   * Экспорт таблицы в Excel
   * @param {Object} action - Объект действия
   */
  const excelExport = async (action) => {
    try {
      let filters0 = prepFilters();
      
      // Создаем URL для скачивания
      const params = new URLSearchParams({
        api_action: 'excel_export',
        filters: JSON.stringify(filters0)
      });
      
      // Создаем временную ссылку для скачивания
      const url = `/api/${props.table}?${params.toString()}`;
      
      // Создаем невидимую ссылку и кликаем по ней
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      notify('success', { detail: 'Экспорт в Excel начат' });
    } catch (error) {
      console.log('error', error);
      notify('error', { detail: error.message });
    }
  };

  /**
   * Вставка новой записи
   */
  const Insert = async () => {
    // Получаем фильтры через функцию prepFilters
    const filters0 = (typeof prepFilters === 'function') ? prepFilters() : {};
    
    try {
      const response = await api.action('insert',{filters: filters0})
      if (!response.success) {
        notify('error', { detail: response.message }, true);
      }
      refresh(false)
    } catch (error) {
      console.log('error',error)
      notify('error', { detail: error.message });
    }
  };

  /**
   * Вставка дочерней записи
   * @param {Object} data - Данные родительской строки
   */
  const Insert_child = async (data) => {
    // Получаем фильтры через функцию prepFilters
    const filters0 = (typeof prepFilters === 'function') ? prepFilters() : {};
    
    try {
      const response = await api.action('insert_child',{[table_tree.value.parentIdField]:data[table_tree.value.idField],filters: filters0})
      if (!response.success) {
        notify('error', { detail: response.message }, true);
      }
      refresh(false)
    } catch (error) {
      console.log('error',error)
      notify('error', { detail: error.message });
    }
  };

  return {
    defHeadAction,
    defRowAction,
    excelExport,
    Insert,
    Insert_child,
    getDataFieldsValues,
    showModalForm,
    hideModalForm,
    submitModalForm,
    processActions
  };
}
