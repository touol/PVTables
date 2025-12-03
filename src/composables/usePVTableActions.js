import { ref, markRaw } from 'vue';
import { compile } from 'vue';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';

/**
 * Composable для управления действиями таблицы
 * @param {Function} notify - Функция уведомлений
 * @param {Object} api - API объект для запросов
 * @param {Function} prepFilters - Функция подготовки фильтров
 * @param {Function} refresh - Функция обновления таблицы
 * @param {Object} emit - Emit функция компонента
 * @param {Object} props - Props компонента
 * @param {Object} selectedlineItems - Выбранные элементы
 * @param {Object} dataFields - Поля данных
 * @returns {Object} Методы и состояние для работы с действиями
 */
export function usePVTableActions(
  notify,
  api,
  prepFilters,
  refresh,
  emit,
  props,
  selectedlineItems,
  dataFields
) {
  const cur_actions = ref([]);
  const actions_row = ref(false);
  const nemu_actions = ref({});
  const SpeedDialEnabled = ref(false);
  const modalFormDialog = ref(false);
  const modalFormData = ref({});
  const modalFormAction = ref(null);
  const modalFormRowData = ref(null);
  const modalFormType = ref('');
  const modalFormColumns = ref([]);

  /**
   * Функция валидации шаблона на предмет безопасности
   * @param {String} template - Шаблон для валидации
   * @returns {Boolean} Результат валидации
   */
  const validateTemplate = (template) => {
    if (!template || typeof template !== 'string') return true;

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

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(template)) {
        console.warn(`Обнаружен потенциально опасный паттерн в шаблоне: ${pattern}`);
        return false;
      }
    }

    return true;
  };

  /**
   * Функция компиляции кастомного шаблона для действий
   * @param {String} template - Шаблон для компиляции
   * @returns {Object|null} Скомпилированный компонент или null
   */
  const compileActionTemplate = (template) => {
    if (!template) return null;

    if (!validateTemplate(template)) {
      console.error('Шаблон содержит потенциально опасные конструкции');
      notify('error', { detail: 'Шаблон содержит потенциально опасные конструкции и не может быть использован' });
      return null;
    }

    try {
      const compiledRender = compile(template);

      return markRaw({
        render: compiledRender,
        props: ['data', 'columns', 'table', 'filters', 'action'],
        emits: ['action-click'],
        setup(props, { emit }) {
          return {
            emitEvent: emit,
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
   * Получение значений data_fields для строки
   * @param {Object} data - Данные строки
   * @returns {Object} Объект со значениями data_fields
   */
  const getDataFieldsValues = (data) => {
    if (!dataFields.value || dataFields.value.length === 0) {
      return {};
    }
    let result = {};
    dataFields.value.forEach(field => {
      if (data.hasOwnProperty(field)) {
        result[field] = data[field];
      }
    });
    return result;
  };

  /**
   * Действие по умолчанию для заголовка
   * @param {Object} tmp - Объект действия
   */
  const defHeadAction = async (tmp) => {
    if (tmp.modal_form) {
      showModalForm(tmp, null, 'head');
      return;
    }

    let requestData = { filters: prepFilters() };

    if (dataFields.value && dataFields.value.length > 0 && selectedlineItems.value && selectedlineItems.value.length > 0) {
      requestData.data_fields_values = selectedlineItems.value.map(item => getDataFieldsValues(item));
    }

    if (selectedlineItems.value && selectedlineItems.value.length > 0) {
      requestData.ids = selectedlineItems.value.map(item => item.id).join(',');
    }

    try {
      const resp = await api.action(tmp.action, requestData);
      if (!resp.success) notify('error', { detail: resp.message });
      refresh(false);
    } catch (error) {
      console.log('error', error);
      notify('error', { detail: error.message });
    }
  };

  /**
   * Действие по умолчанию для строки
   * @param {Object} event - Данные строки
   * @param {Object} tmp - Объект действия
   */
  const defRowAction = async (event, tmp) => {
    if (tmp.modal_form) {
      showModalForm(tmp, event, 'row');
      return;
    }

    let requestData = { ...event, filters: prepFilters() };

    if (dataFields.value && dataFields.value.length > 0) {
      requestData.data_fields_values = [getDataFieldsValues(event)];
    }

    try {
      const resp = await api.action(tmp.action, requestData);
      emit('get-response', { table: props.table, action: tmp.action, response: resp });
      if (!resp.success) notify('error', { detail: resp.message });
      refresh(false);
    } catch (error) {
      console.log('error', error);
      notify('error', { detail: error.message });
    }
  };

  /**
   * Обработчик действия из меню
   * @param {Object} event - Событие с action
   * @param {Object} data - Данные строки
   * @param {Array} columns - Колонки таблицы
   * @param {String} table - Имя таблицы
   * @param {Object} filters - Фильтры
   */
  const PVTablesMenuAction = (event, data, columns, table, filters) => {
    if (nemu_actions.value[event.action]) {
      if (nemu_actions.value[event.action].click) {
        nemu_actions.value[event.action].click(data, columns, table, filters);
      }
    }
  };

  /**
   * Показать модальную форму
   * @param {Object} action - Объект действия
   * @param {Object} rowData - Данные строки
   * @param {String} type - Тип ('head' или 'row')
   */
  const showModalForm = (action, rowData, type) => {
    modalFormAction.value = action;
    modalFormRowData.value = rowData;
    modalFormType.value = type;
    modalFormData.value = {};

    modalFormColumns.value = [];
    if (action.modal_form && action.modal_form.fields) {
      for (let fieldName in action.modal_form.fields) {
        let field = { ...action.modal_form.fields[fieldName] };
        field.field = fieldName;
        if (!field.label) field.label = fieldName;
        if (!field.type) field.type = 'text';
        modalFormColumns.value.push(field);

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
   * Отправить модальную форму
   */
  const submitModalForm = async () => {
    if (!modalFormAction.value) return;

    let requestData = { ...modalFormData.value, filters: prepFilters() };

    if (modalFormType.value === 'row' && modalFormRowData.value) {
      requestData = { ...modalFormRowData.value, ...requestData };

      if (dataFields.value && dataFields.value.length > 0) {
        requestData.data_fields_values = [getDataFieldsValues(modalFormRowData.value)];
      }
    } else if (modalFormType.value === 'head') {
      if (dataFields.value && dataFields.value.length > 0 && selectedlineItems.value && selectedlineItems.value.length > 0) {
        requestData.data_fields_values = selectedlineItems.value.map(item => getDataFieldsValues(item));
      } else if (selectedlineItems.value && selectedlineItems.value.length > 0) {
        requestData.ids = selectedlineItems.value.map(item => item.id).join(',');
      }
    }

    try {
      const resp = await api.action(modalFormAction.value.action, requestData);
      emit('get-response', { table: props.table, action: modalFormAction.value.action, response: resp });

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
   * Excel экспорт
   * @param {Object} action - Объект действия
   */
  const excelExport = async (action) => {
    try {
      const params = new URLSearchParams({
        api_action: 'excel_export',
        filters: JSON.stringify(prepFilters())
      });

      const url = `/api/${props.table}?${params.toString()}`;

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
   * Обработчики успеха/ошибки печати
   */
  const handlePrintSuccess = (result) => {
    notify('success', { detail: 'Печать выполнена успешно' });
  };

  const handlePrintError = (error) => {
    notify('error', { detail: `Ошибка печати: ${error.message}` });
  };

  return {
    cur_actions,
    actions_row,
    nemu_actions,
    SpeedDialEnabled,
    modalFormDialog,
    modalFormData,
    modalFormAction,
    modalFormRowData,
    modalFormType,
    modalFormColumns,
    compileActionTemplate,
    defHeadAction,
    defRowAction,
    PVTablesMenuAction,
    showModalForm,
    hideModalForm,
    submitModalForm,
    excelExport,
    handlePrintSuccess,
    handlePrintError
  };
}
