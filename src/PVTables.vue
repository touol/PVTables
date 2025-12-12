<template>
  <div class="card">
    <Popover ref="op">
      <div style="padding: 1rem;">
        <MultiSelect :modelValue="selectedColumns" :options="columns" optionLabel="label" @update:modelValue="(val) => onToggleColomns(val)"
          placeholder="Выберете столбцы" :maxSelectedLabels="3"/>
        
        <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
          <Button label="Сбросить локальные стили" icon="pi pi-refresh" 
            @click="() => resetLocalFieldsStyle(refresh)" size="small" severity="secondary"/>
          <Button label="Сбросить стили на сервере" icon="pi pi-server" 
            @click="() => resetServerFieldsStyle(refresh)" size="small" severity="warning"/>
          <Button label="Сохранить стили на сервере" icon="pi pi-save" 
            @click="saveFieldsStyleToServer" size="small" severity="success"/>
        </div>
      </div>
    </Popover>
    
    <Popover ref="virtualScrollPopover">
      <div class="virtual-scroll-settings" style="min-width: 300px; padding: 1rem;">
        <p class="mb-3" style="font-size: 0.9rem; color: #666;">
          Ускоряет отрисовку больших таблиц. Работает только с фиксированной высотой строк.
        </p>
        
        <div class="field-checkbox mb-3" style="display: flex; align-items: center; gap: 0.5rem;">
          <ToggleSwitch v-model="virtualScrollEnabled" @change="onVirtualScrollToggle" inputId="vs-toggle" />
          <label for="vs-toggle" style="margin: 0;">Включить виртуальный скроллинг</label>
        </div>
        
        <div class="field mb-3">
          <label for="row-height" style="display: block; margin-bottom: 0.5rem;">Высота строки (px)</label>
          <InputNumber v-model="rowHeight" :disabled="!virtualScrollEnabled" :min="30" :max="200" inputId="row-height" style="width: 100%;" />
          <small class="block mt-1" style="color: #666;">Автоопределенная: {{ calculatedRowHeight }}px</small>
        </div>
        
        <Button label="Пересчитать" icon="pi pi-refresh" @click="recalculateRowHeight" size="small" :disabled="!virtualScrollEnabled" />
      </div>
    </Popover>
    <Toolbar class="p-mb-4">
      <template #start>
        <Button
          v-for="action in cur_actions.filter((x) => x.head)"
          :icon="action.icon"
          :label="action.label"
          :class="action.class"
          @click="action.head_click($event,table,filters,selectedlineItems)"
        />
        <!-- Компонент печати PVPrint -->
        <PVPrintAction 
          v-if="actions1 && actions1.print && actions1.print !== false"
          :table="table"
          :filters="filters"
          :api="api"
          :page-key="`pvtables-${table}`"
          @print-success="handlePrintSuccess"
          @print-error="handlePrintError"
        />
      </template>
      <template #center>
        <template
          v-for="filter of topFilters"
          :key="filter.field"
        >
          <PVAutoComplete v-if="filter.type=='autocomplete'"
            :field="filter"
            v-model="filter.default"
            :options="filter.rows"
            @set-value="
              onSetTopFilter(filter)
            "
            
          />
          <PVMultiAutoComplete
            v-else-if="filter.type == 'multiautocomplete'"
            :field="filter"
            v-model="filter.default"
            :options="filter.rows"
            @set-value="
              onSetTopFilter(filter)
            "
          />
        </template>
      </template>
      <template #end>
        <Button
          :icon="cellSelectionMode ? 'pi pi-check-square' : 'pi pi-table'"
          :class="cellSelectionMode ? 'p-button-success' : ''"
          @click="toggleCellSelectionMode"
          v-tooltip.bottom="'Режим выделения ячеек (Ctrl+Shift+S)'"
        />
        <Button
          :icon="['p-button-icon  pi', { 'pi-moon': darkTheme, 'pi-sun': !darkTheme }]"
          v-tooltip.bottom="'Обновить таблицу'"
          @click="toggleDarkMode"
        />
        <Button
          icon="pi pi-refresh"
          class=" p-button-success"
          v-tooltip.bottom="'Обновить таблицу'"
          @click="refresh(false)"
        />
        <Button
          type="button"
          icon="pi pi-filter-slash"
          v-tooltip.bottom="'Очистить фильтры и сортировку'"
          @click="clearFilter()"
        />
        <Button
          type="button"
          icon="pi pi-cog"
          v-tooltip.bottom="'Настройка колонок. Скрыть и ширина.'"
          @click="toggleSettings($event, columns)"
        />
        <Button
          type="button"
          :icon="virtualScrollEnabled ? 'pi pi-bolt' : 'pi pi-forward'"
          :class="virtualScrollEnabled ? 'p-button-warning' : ''"
          @click="toggleVirtualScrollSettings"
          v-tooltip.bottom="'Виртуальный скроллинг'"
        />
      </template>
    </Toolbar>
    <StatusBar 
      v-if="cellSelectionMode && selectedCells.length > 0"
      :selectedCells="selectedCells"
      @copy="handleCellCopy"
    />
    <DataTable
      :value="lineItems"
      lazy
      
      :virtualScrollerOptions="virtualScrollerOptions"

      paginator
      :first="first"
      :rows="rowsPerPage"
      :rowsPerPageOptions="[10, 60, 30, 1000]"
      paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
      currentPageReportTemplate="{first} to {last} of {totalRecords}"

      ref="dt"
      dataKey="id"
      :totalRecords="totalRecords"
      :loading="loading"
      @page="onPage($event)"
      @sort="onSort($event)"
      sortMode="multiple"

      editMode="cell"
      @cell-edit-complete="onCellEditComplete"
      v-model:selection="selectedlineItems"
      :selectAll="selectAll"
      @select-all-change="onSelectAllChange"
      @row-select="onRowSelect"
      @row-unselect="onRowUnselect"

      v-model:filters="filters"
      filterDisplay="menu"
      :globalFilterFields="globalFilterFields"
      @filter="onFilter($event)"
      :filterList="filterList"
      
      v-model:expandedRows="expandedRowsComposable"
      showGridlines

      scrollable scrollHeight="85vh"
      resizableColumns columnResizeMode="expand"
      @column-resize-end="onColumnResizeEnd"

      size="small"

      :rowClass="rowClass"
      :rowStyle="rowStyle"

      :rowGroupMode="rowGroupMode"
      :groupRowsBy="groupRowsBy"
      
      :data-cell-selection-mode="cellSelectionMode"
      :cellSelectionMode="cellSelectionMode"
      :cellSelectionState="{ 
        isSelecting, 
        selectedCells, 
        onCellMouseDown, 
        onCellMouseEnter 
      }"
      >
      <Column v-if="table_tree" headerStyle="width: 3rem">
        <template #body="{ data }">
          <template v-if="data['gtsapi_children_count'] > 0">
            <Button v-if="expandedTableTreeRowsComposable[data.id]" icon="pi pi-angle-down" class="p-button-text" @click="toogleExpandRowComposable(data)"/>
            <Button v-else icon="pi pi-angle-right" class="p-button-text" @click="toogleExpandRowComposable(data)"/>
          </template>
        </template>
      </Column>
      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
      
      

      <!-- Стиль таблицы: pro (по умолчанию) -->
      <template>
        <Column
          v-for="col of columns.filter((x) => x.modal_only != true && x.type != 'hidden' && !(hideId && x.field == 'id'))"
          :field="col.field"
          :header="col.label"
          sortable
          :dataType="col.dataType"
          :class="getClassTD(col)"
          :style="getColumnStyle(col)"
          :pt="{ bodyCell: { onKeydown: onKeyDown } }"
          >
          <template #body="{ data, field }">
            <div :class="getClassBody(col,data)">
              <Field
                :field="col"
                :data="data"
                :use_data="true"
                :autocompleteSettings="autocompleteSettings[field]"
                :selectSettings="selectSettings[field]"
                @set-value="
                  onCellEditComplete({ data, field, newValue: $event })
                "
                :customFields="customFields[data.id]"
                />
            </div>
          </template>
          <template v-if="!['multiautocomplete', 'boolean', 'date' , 'datetime', 'html', 'view', 'file'].includes(col.type) && !col.readonly" #editor="{ data, field }">
            
            <EditField
              :field="col"
              v-model="data[field]"
              :data="data"
              :use_data="true"
              :autocompleteSettings="autocompleteSettings[field]"
              :selectSettings="selectSettings[field]"
              :customFields="customFields[data.id]"
              @tab="onTab"
            />
          </template>
          <template #filter="{ filterModel }">
            <EditField
              :field="col"
              :use_readonly="false"
              v-model="filterModel.value"
              :autocompleteSettings="autocompleteSettings[col.field]"
              :selectSettings="selectSettings[col.field]"
              :editId="true"
            />
          </template>
        </Column>
      </template>
      <Column
        v-if="actions_row"
        :exportable="false"
        class="td-actions"
        >
        <template #body="slotProps">
          <template v-for="action in cur_actions.filter((x) => x.row && x.menu !== 1)" :key="action.action">
            <!-- Кастомный Vue шаблон для действия, если указан -->
            <component 
              v-if="action.compiledTemplate" 
              :is="action.compiledTemplate" 
              :data="slotProps.data"
              :columns="columns"
              :table="table"
              :filters="filters"
              :action="action"
              @action-click="action.click(slotProps.data, columns, table, filters)"
            />
            <!-- Стандартная кнопка действия -->
            <Button
              v-else
              :icon="action.icon"
              :class="action.class"
              @click="action.click(slotProps.data, columns,table,filters)"
            />
          </template>
          <!-- <SplitButton v-if="SpeedDialEnabled" :model="speedDialActions" class="split-button" /> -->
          <PVTablesSplitButton 
            v-if="SpeedDialEnabled"
            :actions="nemu_actions" 
            @pvtables-menu-action="PVTablesMenuAction($event,slotProps.data, columns,table,filters)"
          />
        </template>
      </Column>
      <template #expansion="slotProps">
        <div v-if="subsComposable[slotProps.data.id].action == 'subtables'" class="p-3">
          <PVTables
            :table="subsComposable[slotProps.data.id].table"
            :actions="actions"
            :filters="subfiltersComposable[slotProps.data.id]"
            @refresh-table="refresh(false)"
            :child="true"
            :ref="el => { if (el) childComponentRefsComposable[slotProps.data.id] = el }"
            @get-response="get_response($event)"
            />
        </div>
        <div v-if="subsComposable[slotProps.data.id].action == 'subtabs'" class="p-3">
          <PVTabs 
            :tabs="subsComposable[slotProps.data.id].tabs"
            :actions="actions"
            :parent_row="parentRowComposable"
            :filters="subfiltersComposable[slotProps.data.id]"
            @refresh-table="refresh(false)"
            :child="true"
            :ref="el => { if (el) childComponentRefsComposable[slotProps.data.id] = el }"
            @get-response="get_response($event)"
            />
        </div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="lineItemDialog"
      header="Редактировать"
      modal
      >
      
      <PVForm 
        v-model="lineItem" 
        :columns="columns" 
        :autocompleteSettings="autocompleteSettings" 
        :selectSettings="selectSettings"
        :customFields="customFields[lineItem.id]"
        :mywatch="mywatch"
        :form="form"
      />
      <template #footer>
        <Button
          label="Отмена"
          icon="pi pi-times"
          class="p-button-text"
          @click="hideDialog"
          />
        <Button
          label="Сохранить"
          icon="pi pi-check"
          class="p-button-text"
          @click="saveLineItem"
          />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="deleteLineItemDialog"
      header="Confirm"
      modal
      >
      <div class="confirmation-content">
        <i class="pi pi-exclamation-triangle p-mr-3" style="font-size: 2rem" />
        <span v-if="lineItem">Вы хотите удалить эту запись?</span>
      </div>

      <template #footer>
        <Button
          label="Нет"
          icon="pi pi-times"
          class="p-button-text"
          @click="deleteLineItemDialog = false"
        />
        <Button
          label="Да"
          icon="pi pi-check"
          class="p-button-text"
          @click="deleteLineItem"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="deleteLineItemsDialog"
      header="Confirm"
      modal
      >
      <div class="confirmation-content">
        <i class="pi pi-exclamation-triangle p-mr-3" style="font-size: 2rem" />
        <span v-if="lineItem">Вы хотите удалить отмеченные записи?</span>
      </div>

      <template #footer>
        <Button
          label="Нет"
          icon="pi pi-times"
          class="p-button-text"
          @click="deleteLineItemsDialog = false"
        />
        <Button
          label="Да"
          icon="pi pi-check"
          class="p-button-text"
          @click="deleteSelectedLineItems"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="modalFormDialog"
      :header="modalFormAction?.action || 'Действие'"
      modal
      >
      
      <PVForm 
        v-model="modalFormData" 
        :columns="modalFormColumns" 
        :autocompleteSettings="autocompleteSettings" 
        :selectSettings="selectSettings"
      />
      <template #footer>
        <Button
          label="Отмена"
          icon="pi pi-times"
          class="p-button-text"
          @click="hideModalForm"
          />
        <Button
          :label="modalFormAction?.modal_form?.buttons?.submit?.label || 'Выполнить'"
          :icon="modalFormAction?.modal_form?.buttons?.submit?.icon || 'pi pi-check'"
          class="p-button-text"
          @click="submitModalForm"
          />
      </template>
    </Dialog>
  </div>
  <Toast/>
</template>

<script setup>
  import Toast from 'primevue/toast';
  import Tooltip from 'primevue/tooltip';
  import { ref, onMounted, defineComponent, watch, computed, onBeforeUnmount } from "vue";
  
  // Регистрация директивы для использования в template
  const vTooltip = Tooltip;
  
  // Импорт composables
  import { usePVTableData } from './composables/usePVTableData';
  import { usePVTableCRUD } from './composables/usePVTableCRUD';
  import { usePVTableActions } from './composables/usePVTableActions';
  import { usePVTableExpand } from './composables/usePVTableExpand';
  import { usePVTableCellSelection } from './composables/usePVTableCellSelection';
  import { usePVTableNavigation } from './composables/usePVTableNavigation';
  import { usePVTableStyles } from './composables/usePVTableStyles';
  import { usePVTableFilters } from './composables/usePVTableFilters';
  
  import DataTable from "./components/DataTable/DataTable.vue";
  import Column from "primevue/column";

  import Button from "primevue/button";
  import Toolbar from "primevue/toolbar";
  import Dialog from "primevue/dialog";
  // import SplitButton from 'primevue/splitbutton';
  // import axios from "axios";
  
  // import InputText from "primevue/inputtext";
  // import Textarea from "primevue/textarea";
  // import InputNumber from "primevue/inputnumber";
  // import ToggleSwitch from 'primevue/toggleswitch';
  // import Checkbox from 'primevue/checkbox';
  import MultiSelect from 'primevue/multiselect'
  import Popover from 'primevue/popover';
  import ToggleSwitch from 'primevue/toggleswitch';
  import InputNumber from 'primevue/inputnumber';

  // import GTSDate from "./components/gtsDate.vue";
  // import GTSSelect from "./components/gtsSelect.vue";
  import PVAutoComplete from "./components/PVAutoComplete.vue";
  import PVMultiAutoComplete from "./components/PVMultiAutoComplete.vue";
  import Field from "./components/Field.vue";
  import EditField from "./components/EditField.vue";
  import { useNotifications } from "./components/useNotifications";

  import PVTabs from './components/PVTabs.vue'
  import PVForm from "./components/PVForm.vue";
  import PVTablesSplitButton from './components/PVTablesSplitButton.vue'
  import PVPrintAction from './components/PVPrintAction.vue'
  import StatusBar from './components/DataTable/StatusBar.vue'

  import { useActionsCaching } from "./composables/useActionsCaching";
  import { useVirtualScroll } from "./composables/useVirtualScroll";
  import apiCtor from './components/api'
  import { rowsHandler } from "./core/helpers";


  const props = defineProps({
    table: {
      type: String,
      required: true,
    },
    actions: {
      type: Object,
      default: {},
    },
    reload: {
      type: Boolean,
    },
    filters: {
      type: Object,
      default: {},
    },
    child:{
      type: Boolean, //и не понятно зачем это. Вроде нет использования переменной.
      default: false
    },
    styleTable: {
      type: String,
      default: 'pro' // 'init' или 'pro'
    }
  });
  const emit = defineEmits(['get-response','refresh-table'])

  const api = apiCtor(props.table)

  const { notify } = useNotifications();

  const nemu_actions = ref({});
  const actions1 = ref({})

  const handlePrintSuccess = (result) => {
    notify('success', { detail: 'Печать выполнена успешно' })
  }

  const handlePrintError = (error) => {
    notify('error', { detail: `Ошибка печати: ${error.message}` })
  }

  // Управление данными таблицы
  const {
    loading,
    totalRecords,
    first,
    lineItems,
    lazyParams,
    autocompleteSettings,
    row_setting,
    customFields,
    filterList,
    createLoadLazyData,
    createOnPage,
    createOnSort,
    findIndexById
  } = usePVTableData();

  const rowsPerPage = ref(10);
  const dt = ref();
  const columns = ref([{ field: "id", label: "ID" }]);
  let fields = {};
  let cur_actions = ref([]);
  const actions_row = ref(false);
  const globalFilterFields = ref([]);
  const selectSettings = ref({});
  let topFilters0 = {}
  const row_class_trigger = ref({})
  const table_tree = ref()
  const SpeedDialEnabled = ref(false)
  const speedDialActions = ref([])
  const rowGroupMode = ref(null)
  const groupRowsBy = ref(null)
  const dataFields = ref([])
  const hideId = ref(false)

  onMounted(async () => {
    loading.value = true;
    lazyParams.value = {
      first: dt.value.first,
      rows: dt.value.rows,
      sortField: null,
      sortOrder: null,
      // filters: filters.value
    };
    try {
      const response = await api.options()

      if (response.data.hasOwnProperty("fields")) {
        fields = response.data.fields;
        if(response.data.limit !== false){
          rowsPerPage.value = response.data.limit
          lazyParams.value.rows = response.data.limit
        }
        if(response.data.selects && typeof response.data.selects === 'object'){
          // Фильтруем только объекты из selects
          for(let key in response.data.selects) {
            if(typeof response.data.selects[key] === 'object' && response.data.selects[key] !== null) {
              selectSettings.value[key] = response.data.selects[key];
            }
          }
        }
        if(response.data.data_fields){
          dataFields.value = response.data.data_fields;
        }
        if(response.data.form){
          form.value = response.data.form;
        }
        if(response.data.hide_id == 1){
          hideId.value = true;
        }
        if (response.data.hasOwnProperty("rowGroupMode")) {
          rowGroupMode.value = response.data.rowGroupMode
          groupRowsBy.value = response.data.groupRowsBy
        }

        let filter_fields = [];
        let cols = [];
        for (let field in fields) {
          fields[field].field = field;
          if (!fields[field].hasOwnProperty("label")) {
            fields[field].label = field;
          }
          if (!Object.prototype.hasOwnProperty.call(fields[field], "type")){
            if(field == 'id'){
              fields[field].type = "view";
            }else{
              fields[field].type = "text";
            }
          }
          if (fields[field].hasOwnProperty("readonly")){
            if(fields[field].readonly === true || fields[field].readonly == 1){
              fields[field].readonly = true
            }else{
              fields[field].readonly = false
            }
          }
          // Инициализируем selectSettings для всех полей
          if(!selectSettings.value[field]) {
            selectSettings.value[field] = {}
          }
          // Если есть select_data, добавляем rows
          if(fields[field].select_data){ 
            selectSettings.value[field].rows = fields[field].select_data
          }
          switch(fields[field].type){
            case "view":case "number":case "decimal":case "autocomplete":
              fields[field].dataType = "numeric"
            break
            case "date":
              fields[field].dataType = "date"
            break
            case "boolean":
              fields[field].dataType = "boolean"
            break
            default:
              fields[field].dataType = "text"
          } 
          cols.push(fields[field]);
          filter_fields.push(field);
        }
        if (response.data.hasOwnProperty("row_class_trigger")) {
          row_class_trigger.value = response.data.row_class_trigger
        }
        if (response.data.hasOwnProperty("table_tree")) {
          table_tree.value = response.data.table_tree
        }
        if (response.data.hasOwnProperty("filters")) {
          topFilters0 = response.data.filters
          for(let field in topFilters0){
            topFilters0[field].field = field;
            if(topFilters0[field].default) topFilters0[field].default = topFilters0[field].default.toString()
            if (!topFilters0[field].hasOwnProperty("label")) {
              topFilters0[field].label = field;
            }
            topFilters0[field].rows = [];
            if (!topFilters0[field].hasOwnProperty("type")) topFilters0[field].type = "text";
          }
        }
        globalFilterFields.value = filter_fields;
        
        // Создаем временную функцию loadLazyData для composable
        let composableLoadLazyData = null;
        
        // Инициализируем composable фильтров
        const filtersComposable = usePVTableFilters(
          props, 
          fields, 
          topFilters0, 
          (...args) => composableLoadLazyData?.(...args), // Используем прокси-функцию
          dt, 
          lazyParams
        );
        
        filters = filtersComposable.filters;
        topFilters = filtersComposable.topFilters;
        initFilters = filtersComposable.initFilters;
        onSetTopFilter = filtersComposable.onSetTopFilter;
        prepFilters = filtersComposable.prepFilters;
        onFilter = filtersComposable.onFilter;
        clearFilter = filtersComposable.clearFilter;

        // Создаем функции загрузки данных
        loadLazyData = createLoadLazyData(api, fields, filters, () => prepFilters(), notify);
        composableLoadLazyData = loadLazyData; // Связываем прокси с реальной функцией
        onPage = createOnPage(loadLazyData);
        onSort = createOnSort(loadLazyData);
        
        // Инициализируем фильтры ПОСЛЕ создания loadLazyData
        initFilters();

        actions1.value = response.data.actions;

        // Обрабатываем действия через composable
        const processedActions = actionsComposable.processActions(
          response.data.actions,
          props.actions,
          {
            editLineItem,
            confirmDeleteLineItem,
            confirmDeleteSelected,
            openNew,
            setExpandedRow: setExpandedRowComposable
          }
        );

        cur_actions.value = processedActions.cur_actions;
        nemu_actions.value = processedActions.nemu_actions;
        actions_row.value = processedActions.actions_row;
        SpeedDialEnabled.value = processedActions.SpeedDialEnabled;
        
        columns.value = cols;
        
        // Загружаем стили с сервера (если есть)
        loadServerFieldsStyle(response.data);
        
        // Применяем стили колонок (приоритет: локальные → серверные → дефолтные)
        // Передаем attributeSelector из DataTable для правильного CSS селектора
        await loadLazyData();
        
        // Применяем стили после загрузки данных, когда таблица отрендерена
        setTimeout(() => {
          if (dt.value && dt.value.attributeSelector) {
            applyColumnWidths(columns, dt.value.attributeSelector);
          }
        }, 200);
      } else {
        // Поля не пришли с сервера
        console.error('Fields not received from server', response.data);
        notify('error', { detail: 'Ошибка: поля таблицы не получены с сервера' }, true);
        loading.value = false;
      }
    } catch (error) {
      console.log('error',error)
      notify('error', { detail: error.message }, true);
      loading.value = false;
    }
    
    document.addEventListener('keydown', handleCellSelectionKeyDown);
    document.addEventListener('mouseup', onCellMouseUp);
  });
  
  // Очистка при размонтировании
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleCellSelectionKeyDown);
    document.removeEventListener('mouseup', onCellMouseUp);
  });
  const PVTablesMenuAction = (event,data, columns,table,filters) => {
    if(nemu_actions.value[event.action]){
      if(nemu_actions.value[event.action].click){
        nemu_actions.value[event.action].click(data, columns, table, filters)
      }
    }
  }
  
  const form = ref({});

  // Функции будут созданы после инициализации в onMounted
  let loadLazyData;
  let onPage;
  let onSort;
  
  const refresh = (from_parent,table) => {
    if(!table || table == props.table){
      if(loadLazyData) {
        loadLazyData();
      }
      if(!from_parent) emit('refresh-table')
    }else if(table && childComponentRefsComposable.value){
      for(let id in childComponentRefsComposable.value){
        childComponentRefsComposable.value[id].refresh(true,table)
      }
    }
  };
  defineExpose({ refresh });
  
  // Переменные для composable фильтров (будут инициализированы в onMounted)
  let filters, topFilters, initFilters, onSetTopFilter, prepFilters, onFilter, clearFilter;

  const { cacheAction, cache } = useActionsCaching()

  // Виртуальный скроллинг
  const {
    virtualScrollEnabled,
    rowHeight,
    calculatedRowHeight,
    virtualScrollPopover,
    virtualScrollerOptions,
    onVirtualScrollToggle,
    toggleVirtualScrollSettings,
    recalculateRowHeight,
    getVirtualScrollRowStyle
  } = useVirtualScroll({
    columns,
    lineItems,
    dt,
    storageKey: `pvtables-virtual-scroll-${props.table}`
  });

  // Навигация по ячейкам
  const {
    findCell,
    findNextEditableColumn,
    findPrevEditableColumn,
    onTab,
    onKeyDown,
    moveCell
  } = usePVTableNavigation();

  // Стили таблицы
  const stylesComposable = usePVTableStyles(row_setting, row_class_trigger, customFields, hideId, api, props.table, notify);
  
  const {
    op,
    selectedColumns,
    darkTheme,
    serverFieldsStyle,
    toggleDarkMode,
    getClassBody,
    getClassTD,
    getColumnStyle,
    rowClass,
    baseRowStyle,
    applyColumnWidths,
    saveColumnWidthsToLocal,
    saveFieldsStyleToServer,
    resetLocalFieldsStyle,
    resetServerFieldsStyle,
    loadServerFieldsStyle
  } = stylesComposable;
  
  // Оборачиваем toggleSettings и onToggleColomns для передачи columns
  const toggleSettings = (event) => {
    stylesComposable.toggleSettings(event, columns);
  };
  
  const onToggleColomns = (val) => {
    stylesComposable.onToggleColomns(val, columns);
  };

  // Выделение ячеек
  const {
    cellSelectionMode,
    selectedCells,
    selectionStart,
    isSelecting,
    toggleCellSelectionMode,
    getCellData,
    onCellMouseDown,
    onCellMouseEnter,
    onCellMouseUp,
    handleCellCopy,
    handleKeyDown: handleCellSelectionKeyDown
  } = usePVTableCellSelection(columns, lineItems, hideId, table_tree);

  // Раскрытие строк
  const {
    expandedRows: expandedRowsComposable,
    expandedTableTreeRows: expandedTableTreeRowsComposable,
    subs: subsComposable,
    subfilters: subfiltersComposable,
    parent_row: parentRowComposable,
    childComponentRefs: childComponentRefsComposable,
    toogleExpandRow: toogleExpandRowComposable,
    setExpandedRow: setExpandedRowComposable,
    delExpand: delExpandComposable
  } = usePVTableExpand(table_tree, filters, dataFields, props.table);

  // Modal form для кастомных действий
  const modalFormDialog = ref(false);
  const modalFormData = ref({});
  const modalFormAction = ref(null);
  const modalFormRowData = ref(null);
  const modalFormType = ref(''); // 'head' или 'row'
  const modalFormColumns = ref([]);

  // Инициализация composable действий (до CRUD, так как нужен в onMounted)
  const actionsComposable = usePVTableActions({
    api,
    props,
    prepFilters: () => prepFilters(),
    refresh,
    notify,
    emit,
    dataFields,
    selectedlineItems: ref([]), // Временное значение, будет заменено
    table_tree,
    filters: () => filters,
    modalFormDialog,
    modalFormData,
    modalFormAction,
    modalFormRowData,
    modalFormType,
    modalFormColumns
  });

  // Извлекаем функции из composable
  const defHeadAction = actionsComposable.defHeadAction;
  const defRowAction = actionsComposable.defRowAction;
  const excelExport = actionsComposable.excelExport;
  const getDataFieldsValues = actionsComposable.getDataFieldsValues;
  const showModalForm = actionsComposable.showModalForm;
  const hideModalForm = actionsComposable.hideModalForm;
  const submitModalForm = actionsComposable.submitModalForm;

  // Инициализация CRUD composable
  const crudComposable = usePVTableCRUD(
    api,
    () => prepFilters(),
    notify,
    refresh,
    emit,
    props,
    lineItems,
    findIndexById,
    customFields,
    row_setting,
    table_tree,
    expandedTableTreeRowsComposable,
    childComponentRefsComposable
  );

  // Извлекаем функции и переменные из CRUD composable
  const {
    lineItem,
    submitted,
    lineItemDialog,
    deleteLineItemDialog,
    deleteLineItemsDialog,
    selectedlineItems,
    selectAll,
    mywatch,
    openNew,
    editLineItem,
    hideDialog,
    saveLineItem,
    Insert,
    Insert_child,
    confirmDeleteLineItem,
    deleteLineItem,
    confirmDeleteSelected,
    deleteSelectedLineItems,
    onCellEditComplete,
    onSelectAllChange,
    onRowSelect,
    onRowUnselect
  } = crudComposable;

  // Обновляем selectedlineItems в actionsComposable после инициализации CRUD
  actionsComposable.selectedlineItems = selectedlineItems;

  // Обработчик изменения размера колонки
  const onColumnResizeEnd = (event) => {
    if (!dt.value || !dt.value.$refs.table) return;
    
    saveColumnWidthsToLocal(dt.value.$refs.table, columns);
    
    // Переприменяем стили после изменения размера
    if (dt.value.attributeSelector) {
      applyColumnWidths(columns, dt.value.attributeSelector);
    }
  };

  const rowStyle = getVirtualScrollRowStyle(baseRowStyle);
  const get_response = (event) => {
    emit('get-response', event)
  }
</script>
