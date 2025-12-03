<template>
  <div class="card">
    <Popover ref="op">
      <MultiSelect :modelValue="selectedColumns" :options="columns" optionLabel="label" @update:modelValue="onToggleColomns"
        placeholder="Выберете столбцы" :maxSelectedLabels="3"/>
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
        <button class="p-button p-component p-button-icon-only " @click="toggleDarkMode">
          <span :class="['p-button-icon  pi', { 'pi-moon': darkTheme, 'pi-sun': !darkTheme }]"></span>
          <span class="p-button-label" data-pc-section="label">&nbsp;</span>
        </button>
        <Button
          icon="pi pi-refresh"
          class=" p-button-success"
          @click="refresh(false)"
        />
        <Button
          type="button"
          icon="pi pi-filter-slash"
          @click="clearFilter()"
        />
        <Button
          type="button"
          icon="pi pi-cog"
          @click="toggleSettings"
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
      
      <!-- Стиль таблицы: init -->
      <template v-if="styleTable === 'init'">
        <Column
          v-for="col of columns.filter((x) => x.modal_only != true && x.type != 'hidden' && !(hideId && x.field == 'id'))"
          :field="col.field"
          :header="col.label"
          sortable
          :dataType="col.dataType"
          :class="getClassTD(col)"
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
          <template v-if="!['autocomplete', 'multiautocomplete', 'select', 'boolean', 'date' , 'datetime', 'html', 'view', 'file'].includes(col.type) && !col.readonly" #editor="{ data, field }">
            
            <EditField
              :field="col"
              v-model="data[field]"
              :data="data"
              :use_data="true"
              :autocompleteSettings="autocompleteSettings[field]"
              :selectSettings="selectSettings[field]"
              :customFields="customFields[data.id]"
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

      <!-- Стиль таблицы: pro (по умолчанию) -->
      <template v-else>
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
  import { ref, onMounted, defineComponent, watch, computed, markRaw, onBeforeUnmount } from "vue";
  import { compile } from "vue";
  
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
  
  import DataTable from "./components/DataTable/DataTable.vue";
  import Column from "primevue/column";

  import Button from "primevue/button";
  import Toolbar from "primevue/toolbar";
  import Dialog from "primevue/dialog";
  // import SplitButton from 'primevue/splitbutton';
  // import axios from "axios";

  //import fields component
  import { FilterMatchMode, FilterOperator } from "@primevue/core/api";
  
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

  // Управление фильтрами таблицы
  const filters = ref();
  const topFilters = ref({});

  const nemu_actions = ref({});
  const actions1 = ref({})

  const handlePrintSuccess = (result) => {
    notify('success', { detail: 'Печать выполнена успешно' })
  }

  const handlePrintError = (error) => {
    notify('error', { detail: `Ошибка печати: ${error.message}` })
  }

  const initFilters = () => {
    let filters0 = {};
    
    // Инициализация фильтров для полей таблицы
    for (let field in fields) {
      if (props.filters.hasOwnProperty(field)) {
        filters0[field] = props.filters[field];
      } else if (fields[field].filter) {
        filters0[field] = fields[field].filter;
      } else {
        switch (fields[field].type) {
          case 'autocomplete':
          case 'multiautocomplete':
          case 'select':
          case 'decimal':
          case 'number':
          case 'view':
            filters0[field] = {
              operator: FilterOperator.AND,
              constraints: [
                { value: null, matchMode: FilterMatchMode.EQUALS },
              ],
            };
            break;
          case 'boolean':
            filters0[field] = {
              value: null,
              matchMode: FilterMatchMode.EQUALS
            };
            break;
          case 'date':
            filters0[field] = {
              operator: FilterOperator.AND,
              constraints: [
                { value: null, matchMode: FilterMatchMode.DATE_AFTER },
                { value: null, matchMode: FilterMatchMode.DATE_BEFORE },
              ],
            };
            break;
          default:
            filters0[field] = {
              operator: FilterOperator.AND,
              constraints: [
                { value: null, matchMode: FilterMatchMode.STARTS_WITH },
              ],
            };
        }
      }
    }

    // Добавление фильтров из props, которых нет в fields
    for (let field in props.filters) {
      if (!filters0.hasOwnProperty(field)) {
        filters0[field] = props.filters[field];
      }
    }

    // Инициализация верхних фильтров
    for (let field in topFilters0) {
      const value = topFilters0[field].default ? topFilters0[field].default : null;
      filters0[field] = {
        operator: FilterOperator.AND,
        constraints: [
          { value: value, matchMode: FilterMatchMode.EQUALS },
        ],
      };
    }

    topFilters.value = JSON.parse(JSON.stringify(topFilters0));
    filters.value = filters0;
  };
  
  watch(() => props.filters, async () => { 
    initFilters();
    await loadLazyData();
  });

  const onSetTopFilter = async (filter) => {
    filters.value[filter.field].constraints[0].value = filter.default;
    await loadLazyData();
  };
  const prepFilters = () => {
    let filters0 = {};
    for (let field in filters.value) {
      if (filters.value[field].hasOwnProperty('constraints')) {
        if (filters.value[field].constraints[0].value !== null) {
          filters0[field] = filters.value[field];
        }
      } else {
        if (filters.value[field].value !== null) {
          filters0[field] = filters.value[field];
        }
      }
    }
    return filters0;
  };

  const onFilter = async (event) => {
    await loadLazyData(event);
  };
  const clearFilter = async () => {
    initFilters();
    
    // Очистка сортировки
    lazyParams.value.multiSortMeta = [];
    
    // Принудительно обновляем DataTable через ref
    if (dt.value) {
      dt.value.d_multiSortMeta = [];
    }
    
    await loadLazyData();
  };
  // const filterPlaceholder = (col) => {
  //   return "Поиск по " + col.label;
  // };
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
        
        // Инициализируем фильтры
        initFilters();

        // Создаем функции загрузки данных
        loadLazyData = createLoadLazyData(api, fields, filters, prepFilters, notify);
        onPage = createOnPage(loadLazyData);
        onSort = createOnSort(loadLazyData);

        let actions0 = response.data.actions;

        actions1.value = response.data.actions

        // console.log('props.table',props.table)
        // console.log('props.actions',props.actions)
        if (props.actions.hasOwnProperty(props.table)) {
          for (let action in props.actions[props.table]) {
            // console.log('action',action,props.actions[props.table][action])
            actions0[action] = props.actions[props.table][action];
          }
        }
        // Функция валидации шаблона на предмет безопасности
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

        // Функция компиляции кастомного шаблона для действий
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

        // console.log('actions0',actions0)
        for (let action in actions0) {
          let tmp = { ...actions0[action] };
          let addtmp = true;
          
          switch (action) {
            case "update":
              tmp.action = action;
              if (!tmp.hasOwnProperty("row")) tmp.row = true;
              if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-pencil";
              if (!tmp.hasOwnProperty("class"))
                tmp.class = " p-button-success";
              if (!tmp.hasOwnProperty("click"))
                tmp.click = (data) => editLineItem(data,tmp);
              break;
            case "delete":
              if (!tmp.hasOwnProperty("row")) tmp.row = true;
              if (!tmp.hasOwnProperty("head")) tmp.head = true;
              if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-trash";
              if (!tmp.hasOwnProperty("class"))
                tmp.class = " p-button-danger";
              if (!tmp.hasOwnProperty("click"))
                tmp.click = (data) => confirmDeleteLineItem(data);
              if (!tmp.hasOwnProperty("head_click"))
                tmp.head_click = () => confirmDeleteSelected();
              // if(!tmp.hasOwnProperty('head_disabled')) tmp.head_disabled = () => !selectedlineItems.value || !selectedlineItems.value.length
              if (!tmp.hasOwnProperty("label")) tmp.label = "Удалить";
              break;
            case "create":
              tmp.action = action;
              if (!tmp.hasOwnProperty("head")) tmp.head = true;
              if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-plus";
              if (!tmp.hasOwnProperty("class"))
                tmp.class = " p-button-success";
              if (!tmp.hasOwnProperty("head_click"))
                tmp.head_click = () => openNew(tmp);
              // if(!tmp.hasOwnProperty('head_disabled')) tmp.head_disabled = false
              if (!tmp.hasOwnProperty("label")) tmp.label = "Создать";
              break;
            case "insert":
              if (!tmp.hasOwnProperty("head")) tmp.head = true;
              if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-plus";
              if (!tmp.hasOwnProperty("class"))
                tmp.class = " p-button-success";
              if (!tmp.hasOwnProperty("head_click"))
                tmp.head_click = () => Insert();
              // if(!tmp.hasOwnProperty('head_disabled')) tmp.head_disabled = false
              if (!tmp.hasOwnProperty("label")) tmp.label = "Вставить";
              document.addEventListener('keyup', function(e){
                if(!e.ctrlKey) return;
                  if(!e.shiftKey) return;
                  if(e.code == 'KeyZ'){
                    Insert()
                  }
              }, true);
              break;
            case "insert_child":
              if (!tmp.hasOwnProperty("row")) tmp.row = true;
              if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-plus";
              if (!tmp.hasOwnProperty("class"))
                tmp.class = " p-button-success";
              if (!tmp.hasOwnProperty("head_click"))
                tmp.click = (data) => Insert_child(data);
              // if(!tmp.hasOwnProperty('head_disabled')) tmp.head_disabled = false
              if (!tmp.hasOwnProperty("label")) tmp.label = "Вставить";
              document.addEventListener('keyup', function(e){
                if(!e.ctrlKey) return;
                  if(!e.shiftKey) return;
                  if(e.code == 'KeyZ'){
                    Insert()
                  }
              }, true);
              break;
            case "subtables":
              addtmp = false;
              for (let tmptable in actions0[action]) {
                let tmpt = { action:action,...actions0[action][tmptable] };
                tmpt.table = tmptable;
                if (!tmpt.hasOwnProperty("row")) tmpt.row = true;
                if (!tmpt.hasOwnProperty("icon")) tmpt.icon = "pi pi-angle-right";
                if (!tmpt.hasOwnProperty("class"))
                  tmpt.class = " p-button-success";
                if (!tmpt.hasOwnProperty("click"))
                  tmpt.click = (event) => setExpandedRowComposable(event, tmpt);
                actions_row.value = true;
                cur_actions.value.push(tmpt);
              }
              break;
            case "subtabs":
              addtmp = false;
              for (let tmptable in actions0[action]) {
                let tmpt = { action:action,tabs:{ ...actions0[action][tmptable] } };
                tmpt.table = tmptable;
                if (!tmpt.hasOwnProperty("row")) tmpt.row = true;
                if (!tmpt.hasOwnProperty("icon")) tmpt.icon = "pi pi-angle-right";
                if (!tmpt.hasOwnProperty("class"))
                  tmpt.class = " p-button-success";
                if (!tmpt.hasOwnProperty("click"))
                  tmpt.click = (event) => setExpandedRowComposable(event, tmpt);
                actions_row.value = true;
                cur_actions.value.push(tmpt);
              }
              break;
            case "read":
              break
            case "excel_export":
              if (!tmp.hasOwnProperty("head")) tmp.head = true;
              if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-file-excel";
              if (!tmp.hasOwnProperty("class"))
                tmp.class = " p-button-success";
              if (!tmp.hasOwnProperty("head_click"))
                tmp.head_click = () => excelExport(tmp);
              if (!tmp.hasOwnProperty("label")) tmp.label = "Excel";
              break;
            case "print":
              addtmp = false;
              break
            default:
              if (!tmp.hasOwnProperty("class"))
                tmp.class = " p-button-success";
              if(!(tmp.head_click || tmp.click)){
                // console.log('tmp.click',tmp.click)
                if (tmp.head)
                  tmp.head_click = () => defHeadAction(tmp);
                if (tmp.row)
                  tmp.click = (event) => defRowAction(event, tmp);
              }
              
          }
          if(!tmp.action) tmp.action = action;
          if(tmp.hasOwnProperty("menu") && tmp.menu == 1){
            SpeedDialEnabled.value = true
            nemu_actions.value[action] = tmp
            
          }
          // Компилируем template_row если он есть
          if (tmp.template_row) {
            tmp.compiledTemplate = compileActionTemplate(tmp.template_row);
          }
          
          if (addtmp) {
            if (tmp.hasOwnProperty("row")) actions_row.value = true;
            // if (tmp.hasOwnProperty("row")) actions_head.value = true;
            cur_actions.value.push(tmp);
          }
          
        }
        // console.log('cur_actions.value',cur_actions.value)
        // await din_import()
        
        columns.value = cols;
      }
      
      await loadLazyData();
    } catch (error) {
      console.log('error',error)
      notify('error', { detail: error.message }, true);
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
  
  const refresh = (from_parent,table) => {
    if(!table || table == props.table){
      loadLazyData();
      if(!from_parent) emit('refresh-table')
    }else if(table && childComponentRefsComposable.value){
      for(let id in childComponentRefsComposable.value){
        childComponentRefsComposable.value[id].refresh(true,table)
      }
    }
  };
  defineExpose({ refresh });

  const form = ref({});

  // Функции будут созданы после инициализации prepFilters в onMounted
  let loadLazyData;
  let onPage;
  let onSort;


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
  const {
    op,
    selectedColumns,
    darkTheme,
    toggleDarkMode,
    getClassBody,
    getClassTD,
    getColumnStyle,
    rowClass,
    baseRowStyle,
    toggleSettings,
    onToggleColomns
  } = usePVTableStyles(row_setting, row_class_trigger, customFields, hideId);

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

  const onCellEditComplete = async (event) => {
    let { data, newValue, field } = event;
    if(!field) return
    // console.log('field',field)
    // console.log('newValue',newValue)
    if(getField(data,field) == newValue) return

    const payload = {
      id: data.id,
      [field]: newValue,
      update_from_row: 1
    }

    cacheAction({type: 'update', payload})
    let filters0 = {}
    
    for(let field in filters.value){
      if(filters.value[field].hasOwnProperty('constraints')){
        if(filters.value[field].constraints[0].value !== null){
          filters0[field] = filters.value[field]
        }
      }else{
        if(filters.value[field].value !== null){
          filters0[field] = filters.value[field]
        }
      }
    }
    let params = {
      filters: filters0,
    };
    
    try {
      const response = await api.update(payload,params)
      emit('get-response', {table:props.table,action:"update",response:response})
      
      setField(data,field,newValue)
      if (!response.success) {
        notify('error', { detail: response.message }, true);
      }
      if(response.data.refresh_table == 1) refresh(false)

      if(response.data.customFields){
        for(let key in response.data.customFields){
          customFields.value[key] = response.data.customFields[key]
        }
      }
      if(response.data.object){
        lineItems.value[findIndexById(Number(payload.id))] = response.data.object
      }else if(response.data.defvalues){
        // console.log('response.data.defvalues',response.data.defvalues)
        lineItems.value[findIndexById(Number(payload.id))] = {...lineItems.value[findIndexById(Number(payload.id))],...response.data.defvalues}
      }
      if(response.data.row_setting){
        for(let key in response.data.row_setting){
          row_setting.value[key] = response.data.row_setting[key]
        }
      }
      if(expandedTableTreeRowsComposable.value[data.id]){
        if(data['gtsapi_children_count'] == 0){
          toogleExpandRowComposable(data)
        }else{
          childComponentRefsComposable.value[data.id].refresh(true);
        }
        
      }
    } catch (error) {
      // event.preventDefault(); // При ошибке на gtsAutoComplete не срабатывает. Не понятно что делать???
      console.log('error',error)
      notify('error', { detail: error.message }, true);
    }
  };
  function getField(obj, field) {
    return field.split('.').reduce((acc, curr) => acc[curr], obj);
  }
  function setField(obj, field, value) {
    const fields = field.split('.');
    const lastField = fields.pop();
    let target = obj;
    for (let i = 0; i < fields.length; i++) {
      if (!target[fields[i]]) {
        target[fields[i]] = {};
      }
      target = target[fields[i]];
    }
    target[lastField] = value;
  }
  const lineItem = ref({});
  const submitted = ref(false);
  const lineItemDialog = ref(false);
  const mywatch = ref({
    enabled: false,
    fields: [],
    table: '',
    action: ''
  });
  
  //edit row in dialog
  const editLineItem = (item,action) => {
    if(action.watch) mywatch.value = {enabled: true, fields: action.watch, table: props.table, action: action.action, filters: prepFilters()};
    lineItem.value = { ...item };
    lineItemDialog.value = true;
  };

  const hideDialog = () => {
    lineItemDialog.value = false;
    submitted.value = false;
  };


  const saveLineItem = async () => {
    submitted.value = true;
    let filters0 = {}
    for(let field in filters.value){
      if(filters.value[field].hasOwnProperty('constraints')){
        if(filters.value[field].constraints[0].value !== null){
          filters0[field] = filters.value[field]
        }
      }else{
        if(filters.value[field].value !== null){
          filters0[field] = filters.value[field]
        }
      }
    }
    let params = {
      filters: filters0,
      update_from_modal: 1
    };
    if (lineItem.value.id) {

      try {
        const response = await api.update(lineItem.value,params)
        // refresh_table
        if (!response.success) {
          notify('error', { detail: response.message }, true);
        }
        emit('get-response', {table:props.table,action:"update",response:response})
        if(response.data.customFields){
          customFields.value[lineItem.value.id] = response.data.customFields[lineItem.value.id]
        }
        if(response.data.refresh_row == 1) lineItem.value = response.data.object
        if(response.data.refresh_table == 1) refresh(false)
        
        lineItems.value[findIndexById(Number(lineItem.value.id))] = lineItem.value;
        lineItemDialog.value = false;
        lineItem.value = {};
      } catch (error) {
        console.log('error',error)
        notify('error', { detail: error.message });
      }
    } else {
      
      try {
        const response = await api.create(lineItem.value,params)
        emit('get-response', {table:props.table,action:"create",response:response})
        if (!response.success) {
          notify('error', { detail: response.message }, true);
        }
        refresh(false)
        lineItemDialog.value = false;
        lineItem.value = {};
      } catch (error) {
        console.log('error',error)
        notify('error', { detail: error.message });
      }
    }
  };
  const Insert_child = async (data) => {
    let filters0 = {}
    for(let field in filters.value){
      if(filters.value[field].hasOwnProperty('constraints')){
        if(filters.value[field].constraints[0].value !== null){
          filters0[field] = filters.value[field]
        }
      }else{
        if(filters.value[field].value !== null){
          filters0[field] = filters.value[field]
        }
      }
    }
    
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
  const Insert = async () => {
    let filters0 = {}
    for(let field in filters.value){
      if(filters.value[field].hasOwnProperty('constraints')){
        if(filters.value[field].constraints[0].value !== null){
          filters0[field] = filters.value[field]
        }
      }else{
        if(filters.value[field].value !== null){
          filters0[field] = filters.value[field]
        }
      }
    }
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
  //add row
  const openNew = (action) => {
    if(action.watch) mywatch.value = {enabled: true, fields: action.watch, table: props.table, action: action.action, filters: prepFilters()};
    lineItem.value = {};
    submitted.value = false;
    lineItemDialog.value = true;
  };

  // default action
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
  //delete row
  const deleteLineItemDialog = ref(false);
  const deleteLineItemsDialog = ref(false);
  const confirmDeleteLineItem = (item) => {
    lineItem.value = item;
    deleteLineItemDialog.value = true;
  };
  const deleteLineItem = async () => {
    let requestData = { ids: lineItem.value.id }
    
    // Добавляем data_fields для удаляемой строки если они есть (массив с одним объектом)
    if (dataFields.value && dataFields.value.length > 0) {
      requestData.data_fields_values = [getDataFieldsValues(lineItem.value)]
    }
    
    try {
      await api.delete(requestData)

      // TODO желательно рефрешнуть страницу после удаления ряда
      lineItems.value = lineItems.value.filter(
        (val) => val.id !== lineItem.value.id
      );

      deleteLineItemDialog.value = false;
      lineItem.value = {}
    } catch (error) {
      console.log('error',error)
      notify('error', { detail: error.message });
    }
  };
  const confirmDeleteSelected = () => {
    if (selectedlineItems.value && selectedlineItems.value.length)
      deleteLineItemsDialog.value = true;
  };
  const deleteSelectedLineItems = async () => {
    const ids = selectedlineItems.value.map((line) => line.id).join(',');
    
    let requestData = { ids }
    
    // Добавляем data_fields для выбранных строк если они есть
    if (dataFields.value && dataFields.value.length > 0 && selectedlineItems.value && selectedlineItems.value.length > 0) {
      requestData.data_fields_values = selectedlineItems.value.map(item => getDataFieldsValues(item))
    }

    try {
      await api.delete(requestData)

      // TODO желательно рефрешнуть страницу после удаления ряда
      lineItems.value = lineItems.value.filter(
        (val) => !selectedlineItems.value.includes(val)
      );
      deleteLineItemsDialog.value = false;
      selectedlineItems.value = null;
    } catch (error) {
      console.log('error',error)
      notify('error', { detail: error.message });
    }
  };

  //selected
  const selectedlineItems = ref();
  const selectAll = ref(false);

  const onSelectAllChange = (event) => {
    selectAll.value = event.checked;

    if (selectAll.value) {
      selectAll.value = true;
      selectedlineItems.value = lineItems.value;
    } else {
      selectAll.value = false;
      selectedlineItems.value = [];
    }
  };
  const onRowSelect = () => {
    selectAll.value = selectedlineItems.value.length === totalRecords.value;
  };
  const onRowUnselect = () => {
    selectAll.value = false;
  };

  const rowStyle = getVirtualScrollRowStyle(baseRowStyle);
  const get_response = (event) => {
    emit('get-response', event)
  }
  // Modal form для кастомных действий
  const modalFormDialog = ref(false);
  const modalFormData = ref({});
  const modalFormAction = ref(null);
  const modalFormRowData = ref(null);
  const modalFormType = ref(''); // 'head' или 'row'
  const modalFormColumns = ref([]);

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

  const hideModalForm = () => {
    modalFormDialog.value = false;
    modalFormAction.value = null;
    modalFormRowData.value = null;
    modalFormData.value = {};
    modalFormColumns.value = [];
  };

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

  // Excel Export
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
</script>


<style>
  .td-body{
    width: 100%;
    height: 100%;
  }
  .td-body:not(.date){
    margin-top: 10px;
  }
  .td-body.readonly {
      background-blend-mode: multiply;
      background: rgba(190, 164, 164, 0.1);
  }
  td.number,td.decimal,td.textarea,td.text{
    max-width: 100px;
  }
  td.number .p-inputtext,td.decimal .p-inputtext,td.textarea textarea,td.text .p-inputtext{
    width: 100%;
  }
  td.autocomplete .p-autocomplete-dropdown, td.autocomplete .p-inputtext
  ,td.select .p-autocomplete-dropdown, td.select .p-inputtext
  {
    background: inherit;
    border: none;
  }
  .td-body.autocomplete .p-autocomplete-dropdown, .td-body.autocomplete .p-inputtext
  ,.td-body.select .p-autocomplete-dropdown, .td-body.select .p-inputtext
  {
    background: inherit;
    border: none;
  }
  .p-datatable-column-header-content {
    flex-wrap: wrap;
  }
  
  
  html {
    font-size: 14px;
  }
  .p-datatable-resizable-table > .p-datatable-thead > tr > th,
  .p-datatable-resizable-table > .p-datatable-tbody > tr > td.text,
  .p-datatable-resizable-table > .p-datatable-tbody > tr > td.textarea,
  .p-datatable-resizable-table > .p-datatable-tbody > tr > td.html 
  {
    white-space: break-spaces !important;
  }
  /* .p-datatable textarea{
    width:136px;
  } */

  .p-datatable tr.hit{
    background-color: #60cc2fe6;
  }
  .p-datatable tr.attention{
    background-color: rgba(252, 3, 3, 0.8);
  }
  .p-datatable tr.work{
    background-color: #89d7f1;
  }
  .p-datatable tr.outwork{
    background-color: #eff189;
  }
  .p-datatable tr.onsklad{
    background-color: #f19989;
  }
  .p-datatable tr.canceled{
    background-color: #ff684c;
  }
  .p-datatable.p-datatable-sm .p-datatable-tbody > tr > td {
    padding: 0.375rem 0.5rem;
  }
  .p-autocomplete-option:not(.p-autocomplete-option-selected):not(.p-disabled).p-focus {
    background: #9cabbb;
    color: var(--p-autocomplete-option-focus-color);
  }
  .td-actions .p-speeddial {
    display: inline;
  }
  .td-actions{
    white-space: nowrap;
    align-content: center;
  }
  .td-actions .p-speeddial-list {
    position: absolute;
    right: 0;
  }

  .p-datatable .p-inputtext{
    color:black;
  }
  .navbar-collapse.collapse {
     visibility: inherit !important;
  }
  .p-datatable-table td, .p-datatable-table th {
    padding: 8px;
    border: 1px solid #555;
    vertical-align: top;
    color: #000;
  }
  
  /* Стили для виртуального скроллинга */
  .p-datatable table {
    border-collapse: separate !important;
  }
  
  .p-datatable table .p-virtualscroller-content td,
  .p-datatable table .p-virtualscroller-content th {
    max-height: inherit;
    padding: 8px;
    border: 1px solid #555;
    vertical-align: top;
    color: #000;
  }
  
  .p-datatable table .p-virtualscroller-content td .td-body {
    max-height: inherit;
    overflow: auto;
    text-overflow: ellipsis;
    display: block;
  }
</style>
