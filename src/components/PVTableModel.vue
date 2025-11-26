<template>
  <div class="card">
    <Toolbar class="p-mb-4">
      <template #start>
        <Button
          v-for="action in cur_actions.filter((x) => x.head)"
          :icon="action.icon"
          :label="action.label"
          :class="action.class"
          @click="action.head_click($event,table,filters,selectedlineItems)"
        />
      </template>
      <template #center>
        <template
          v-for="filter of topFilters"
          :key="filter.field"
        >
          <GTSAutocomplete v-if="filter.type=='autocomplete'"
            :table="filter.table"
            v-model:id="filter.default"
            :options="filter.rows"
            @set-value="
              onSetTopFilter(filter)
            "
          />
        </template>
      </template>
      <template #end>
        <button class="p-button p-component " @click="toggleDarkMode">
          <i :class="['pi', { 'pi-moon': darkTheme, 'pi-sun': !darkTheme }]"></i>
        </button>
        <!-- <Button
          icon="pi pi-refresh"
          class=" p-button-success"
          @click="refresh()"
        /> -->
        <Button
          type="button"
          icon="pi pi-filter-slash"
          @click="clearFilter()"
        />
      </template>
    </Toolbar>
    <DataTable
      :value="lineItems"

      ref="dt"
      dataKey="id"

      :loading="loading"

      editMode="cell"
      @cell-edit-complete="onCellEditComplete"
      v-model:selection="selectedlineItems"
      :selectAll="selectAll"
      @select-all-change="onSelectAllChange"
      @row-select="onRowSelect"
      @row-unselect="onRowUnselect"

      v-model:filters="filters"
      filterDisplay="menu"
      
      v-model:expandedRows="expandedRows"
      showGridlines

      scrollable scrollHeight="85vh"
      resizableColumns columnResizeMode="expand"

      size="small"

      :rowClass="rowClass"
    >
      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
      <Column
        v-for="col of columns.filter((x) => x.modal_only != true)"
        :field="col.field"
        :header="col.label"
        sortable
        :dataType="col.dataType"
        :class="getClassTD(col)"
      >
        <template #body="{ data, field }">
          <div :class="getClassBody(col,data)">
            <Field
              :field="col"
              :data="data[field]"
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
        <template v-if="!['autocomplete', 'select', 'boolean', 'date' , 'datetime', 'html', 'view'].includes(col.type) && !col.readonly" #editor="{ data, field }">
          <Field
            v-if="customFields[data.id] && customFields[data.id][field] && ['autocomplete', 'select', 'boolean', 'date' , 'datetime', 'html', 'view'].includes(customFields[data.id][field].type)"
            :field="col"
            :data="data[field]"
            :use_data="true"
            :autocompleteSettings="autocompleteSettings[field]"
            :selectSettings="selectSettings[field]"
            @set-value="
              onCellEditComplete({ data, field, newValue: $event })
            "
            :customFields="customFields[data.id]"
            />
          <InputNumber 
            v-else-if="col.type == 'number'" 
            v-model="data[field]"
            :disabled="disableField(data,field)"
          />
          <InputNumber 
            v-else-if="col.type == 'decimal'" 
            v-model="data[field]" 
            :minFractionDigits="col.FractionDigits" 
            :maxFractionDigits="col.FractionDigits" 
            :disabled="disableField(data,field)"
          />
          <Textarea 
            v-else-if="col.type == 'textarea'" 
            v-model="data[field]" rows="1" 
            :disabled="disableField(data,field)"
            />
          <InputText 
            v-else 
            v-model="data[field]" 
            :disabled="disableField(data,field)"
            />
        </template>
        <template #filter="{ filterModel }">
          <template v-if="['autocomplete', 'select', 'boolean', 'date' , 'datetime'].includes(col.type)">
            <Field
              :field="col"
              v-model="filterModel.value"
              :autocompleteSettings="autocompleteSettings[col.field]"
              :selectSettings="selectSettings[col.field]"
              class="p-column-filter"
            />
          </template>
          <template v-else>
            <InputNumber v-if="col.type == 'number'" v-model="filterModel.value"/>
            <InputNumber v-else-if="col.type == 'decimal'" v-model="filterModel.value" :minFractionDigits="col.FractionDigits" :maxFractionDigits="col.FractionDigits" />
            <Textarea v-else-if="col.type == 'textarea'" v-model="filterModel.value" rows="1" />
            <InputText v-else v-model="filterModel.value" />
          </template>
        </template>
      </Column>
      <Column
        v-if="actions_row"
        :exportable="false"
        style="white-space: nowrap"
      >
        <template #body="slotProps">
          <Button
            v-for="action in cur_actions.filter((x) => x.row)"
            :icon="action.icon"
            :class="action.class"
            @click="action.click(slotProps.data, columns,table,filters)"
          />
        </template>
      </Column>
      <template #expansion="slotProps">
        <div v-if="subs[slotProps.data.id].action == 'subtables'" class="p-3">
          <PVTables
            :table="subs[slotProps.data.id].table"
            :actions="actions"
            :filters="subfilters[slotProps.data.id]"
            :ref="el => { if (el) childComponentRefs[slotProps.data.id] = el }"
          />
        </div>
        <div v-if="subs[slotProps.data.id].action == 'subtabs'" class="p-3">
          <PVTabs 
            :tabs="subs[slotProps.data.id].tabs"
            :actions="actions"
            :filters="subfilters[slotProps.data.id]"
            :ref="el => { if (el) childComponentRefs[slotProps.data.id] = el }"
          />
        </div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="lineItemDialog"
      header="Редактировать"
      modal
    >
      
      <PVForm v-model="lineItem" :columns="columns" :autocompleteSettings="autocompleteSettings" :selectSettings="selectSettings"/>
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
  </div>
  <Toast/>
</template>

<script setup>
import Toast from 'primevue/toast';
import { ref, onMounted, defineComponent } from "vue";

import DataTable from "primevue/datatable";
import Column from "primevue/column";

import Button from "primevue/button";
import Toolbar from "primevue/toolbar";
import Dialog from "primevue/dialog";
// import axios from "axios";

//import fields component
import { FilterMatchMode, FilterOperator } from "@primevue/core/api";

import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import InputNumber from "primevue/inputnumber";
import ToggleSwitch from 'primevue/toggleswitch';
import Checkbox from 'primevue/checkbox';

// import GTSDate from "./gtsDate.vue";
// import GTSSelect from "./gtsSelect.vue";
import GTSAutocomplete from "./gtsAutoComplete.vue";
import Field from "./Field.vue";
import { useNotifications } from "./useNotifications";

import PVTabs from './PVTabs.vue'
import PVForm from "./PVForm.vue";

import { useActionsCaching } from "../composables/useActionsCaching";


const lineItems = defineModel({
  type: Array,
  default: [],
});

const props = defineProps({
  table: {
    type: String,
    required: true,
  },
  fields: {
    type: Object,
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
});

// const api = apiCtor(props.table)

const { notify } = useNotifications();

const darkTheme = ref(false);
const toggleDarkMode = () =>{
    const element = document.querySelector('html');
    darkTheme.value = !darkTheme.value
    element.classList.toggle('my-app-dark');
}
// const getDarkIcon = () =>{
//     return 'pi ' + darkTheme.value?'pi-moon':'pi-sun'
// }
// ['pi', { 'pi-moon': darkTheme, 'pi-sun': !darkTheme }]
//filters
const filters = ref();


const initFilters = () => {
  let filters0 = {};
  for (let field in props.fields) {
    if (props.filters.hasOwnProperty(field)) {
      filters0[field] = props.filters[field];
    } else {
      switch (props.fields[field].type) {
        case 'autocomplete': case 'select': case 'decimal': case 'number': case 'view':
          filters0[field] = {
              operator: FilterOperator.AND,
              constraints: [
                { value: null, matchMode: FilterMatchMode.EQUALS },
              ],
            };
        break
        case 'boolean':
          filters0[field] = {
            value: null, matchMode: FilterMatchMode.EQUALS
            };
        break
        case 'date':
          filters0[field] = {
              operator: FilterOperator.AND,
              constraints: [
                { value: null, matchMode: FilterMatchMode.DATE_AFTER },
                { value: null, matchMode: FilterMatchMode.DATE_BEFORE },
              ],
            };
        break
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
  for (let field in props.filters) {
    if (!filters0.hasOwnProperty(field)) {
      filters0[field] = props.filters[field];
    }
  }
  for(let field in topFilters0){
    switch (topFilters0[field].type) {
        default:
          const value = topFilters0[field].default?topFilters0[field].default:null
          filters0[field] = {
            operator: FilterOperator.AND,
            constraints: [
              { value: value, matchMode: FilterMatchMode.EQUALS },
            ],
          };
      }
  }

  topFilters.value = JSON.parse(JSON.stringify(topFilters0))
  filters.value = filters0;
  // filters.value = {
  //   global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  //   // name: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
  //   // 'country.name': { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
  //   // representative: { value: null, matchMode: FilterMatchMode.IN },
  //   // date: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }] },
  //   // balance: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] },
  //   // status: { operator: FilterOperator.OR, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] },
  //   // activity: { value: [0, 100], matchMode: FilterMatchMode.BETWEEN },
  //   // verified: { value: null, matchMode: FilterMatchMode.EQUALS }
  // };
};
const onSetTopFilter = async (filter) => {
  filters.value[filter.field].constraints[0].value = filter.default;
  // await loadLazyData();
};
// const onFilter = async (event) => {
//   // lazyParams.value.filters = filters.value;
//   // await loadLazyData(event);
// };
const clearFilter = async () => {
  initFilters();
  // lazyParams.value.filters = filters.value;
  // await loadLazyData();
};
const filterPlaceholder = (col) => {
  return "Поиск по " + col.label;
};

const dt = ref();
const loading = ref(true);
const totalRecords = ref(0);
const first = ref(0);
const lazyParams = ref({});
const columns = ref([{ field: "id", label: "ID" }]);
// let fields = {};
// const lineItems = ref();
// const countRow  = ref(60);
let cur_actions = ref([]);
const actions_row = ref(false);
// const actions_head = ref(false);
const globalFilterFields = ref([]);
const selectSettings = ref({});
const topFilters = ref({})
let topFilters0 = {}

onMounted(() => {
  loading.value = true;
  lazyParams.value = {
    first: dt.value.first,
    rows: dt.value.rows,
    sortField: null,
    sortOrder: null,
    // filters: filters.value
  };
  for(let key in lineItems.value){
    if(!lineItems.value[key].id) lineItems.value[key].id = key
  }
  try {
    // const response = await api.options()

    // if (response.data.hasOwnProperty("fields")) {
      // fields = response.data.fields;
      let filter_fields = [];
      let cols = [];
      for (let field in props.fields) {
        props.fields[field].field = field;
        if (!props.fields[field].hasOwnProperty("label")) {
          props.fields[field].label = field;
        }
        if (!props.fields[field].hasOwnProperty("type")) props.fields[field].type = "text";
        if (props.fields[field].hasOwnProperty("readonly")){
          if(props.fields[field].readonly === true || props.fields[field].readonly == 1){
            props.fields[field].readonly = true
          }else{
            props.fields[field].readonly = false
          }
        }
        if(props.fields[field].select_data){ 
          if(!selectSettings.value[field]) selectSettings.value[field] = {}
          selectSettings.value[field].rows = props.fields[field].select_data
        }
        cols.push(props.fields[field]);
        filter_fields.push(field);
      }
      // if (response.data.hasOwnProperty("filters")) {
      //   topFilters0 = response.data.filters
      //   for(let field in topFilters0){
      //     topFilters0[field].field = field;
      //     topFilters0[field].default = topFilters0[field].default.toString()
      //     if (!topFilters0[field].hasOwnProperty("label")) {
      //       topFilters0[field].label = field;
      //     }
      //     topFilters0[field].rows = [];
      //     if (!topFilters0[field].hasOwnProperty("type")) topFilters0[field].type = "text";
      //   }
      // }
      globalFilterFields.value = filter_fields;
      initFilters();

      let actions0 = {};

      // console.log('props.table',props.table)
      // console.log('props.actions',props.actions)
      if (props.actions.hasOwnProperty(props.table)) {
        for (let action in props.actions[props.table]) {
          // console.log('action',action,props.actions[props.table][action])
          actions0[action] = props.actions[props.table][action];
        }
      }
      // console.log('actions0',actions0)
      for (let action in actions0) {
        let tmp = { ...actions0[action] };
        let addtmp = true;
        tmp.action = action;
        switch (action) {
          case "update":
            if (!tmp.hasOwnProperty("row")) tmp.row = true;
            if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-pencil";
            if (!tmp.hasOwnProperty("class"))
              tmp.class = " p-button-success";
            if (!tmp.hasOwnProperty("click"))
              tmp.click = (data) => editLineItem(data);
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
            if (!tmp.hasOwnProperty("head")) tmp.head = true;
            if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-plus";
            if (!tmp.hasOwnProperty("class"))
              tmp.class = " p-button-success";
            if (!tmp.hasOwnProperty("head_click"))
              tmp.head_click = () => openNew();
            // if(!tmp.hasOwnProperty('head_disabled')) tmp.head_disabled = false
            if (!tmp.hasOwnProperty("label")) tmp.label = "Создать";
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
                tmpt.click = (event) => setExpandedRow(event, tmpt);
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
                tmpt.click = (event) => setExpandedRow(event, tmpt);
              actions_row.value = true;
              cur_actions.value.push(tmpt);
            }
            break;
        }
        if (addtmp) {
          if (tmp.hasOwnProperty("row")) actions_row.value = true;
          // if (tmp.hasOwnProperty("row")) actions_head.value = true;
          cur_actions.value.push(tmp);
        }
        
      }
      // console.log('cur_actions.value',cur_actions.value)
      // await din_import()
      // if(response.data.selects){
      //   selectSettings.value = response.data.selects;
      // }
      columns.value = cols;
    // }

    // await loadLazyData();
    loading.value = false;
  } catch (error) {
    notify('error', { detail: error.message }, true);
  }
});

//expand row
const expandedRows = ref({});
const subs = ref({});
const childComponentRefs = ref({})


const subfilters = ref({});
const delExpand = async (tmp) => {
  expandedRows.value = { ...tmp };
};
const setExpandedRow = async (event, tmpt) => {
  // console.log('tmpt',tmpt)
  let tmp = { ...expandedRows.value };
  if (tmp.hasOwnProperty(event.id)) {
    if (subs.value[event.id].table == tmpt.table) {
      delete tmp[event.id];
      await delExpand(tmp);
      return;
    } else {
      delete tmp[event.id];
      await delExpand(tmp);
      tmp[event.id] = true;
    }
  } else {
    tmp[event.id] = true;
  }
  subs.value[event.id] = tmpt;

  if(tmpt.action == 'subtables'){
    if (tmpt.hasOwnProperty("where")) {
      let tmpfilters = {};
      for (let field in tmpt.where) {
        tmpfilters[field] = {
          operator: FilterOperator.AND,
          constraints: [
            {
              value: event[tmpt.where[field]],
              matchMode: FilterMatchMode.EQUALS,
            },
          ],
        };
      }
      subfilters.value[event.id] = tmpfilters;
    }
  }else if(tmpt.action == 'subtabs'){
    for(let key in tmpt.tabs){
      if (tmpt.tabs[key].hasOwnProperty("where")) {
        let tmpfilters = {};
        for (let field in tmpt.tabs[key].where) {
          tmpfilters[field] = {
            operator: FilterOperator.AND,
            constraints: [
              {
                value: event[tmpt.tabs[key].where[field]]?event[tmpt.tabs[key].where[field]]:tmpt.tabs[key].where[field],
                matchMode: FilterMatchMode.EQUALS,
              },
            ],
          };
        }
        // console.log('tmpfilters',tmpfilters)
        if(!subfilters.value.hasOwnProperty(event.id)) subfilters.value[event.id] = {}
        subfilters.value[event.id][key] = tmpfilters;
        
      }
    }
  }
  // console.log('subfilters.value',subfilters.value)
  expandedRows.value = { ...tmp };
  // console.log('expandedRows.value',expandedRows.value)
};

// const din_import = async () =>{
//   for(let field in fields){
//     fields[field].field = field
//     switch(fields[field].type){
//       case 'textarea':
//         await import("primevue/textarea");
//       break
//     }
//   }
// }
const autocompleteSettings = ref({});
const row_setting = ref({});

// const loadLazyData = async (event) => {
//   loading.value = true;
//   lazyParams.value = {
//     ...lazyParams.value,
//     first: event?.first || first.value,
//   };
//   // console.log('lazyParams.value',lazyParams.value)
//   // console.log('event',event)
//   // console.log('filters.value',filters.value)
//   let filters0 = {}
//   for(let field in filters.value){
//     if(filters.value[field].hasOwnProperty('constraints')){
//       if(filters.value[field].constraints[0].value !== null){
//         filters0[field] = filters.value[field]
//       }
//     }else{
//       if(filters.value[field].value !== null){
//         filters0[field] = filters.value[field]
//       }
//     }
//   }
//   let params = {
//     limit: lazyParams.value.rows,
//     setTotal: 1,
//     offset: lazyParams.value.first,
//     // sortField:lazyParams.value.sortField,
//     // sortOrder:lazyParams.value.sortOrder,
//     multiSortMeta: lazyParams.value.multiSortMeta,
//     filters: filters0,
//   };
 
//   try {
//     const response = await api.read(params)
    
    
//     lineItems.value = rowsHandler(response.data.rows, fields)

//     // TODO переход на другую страницу не имеет нужных данных, здесь ошибка
//     // нужно или глубоко мёржить данные с имеющимися,
//     // или отдавать полные данные для автокомплита на запрос каждой страницы
//     if(response.data.autocomplete){
//       for(let af in response.data.autocomplete){
//         autocompleteSettings.value[af] = response.data.autocomplete[af];
//       }
//     }
//     if(response.data.row_setting){
//         row_setting.value = response.data.row_setting
//     }   

//     //

//     totalRecords.value = response.data.total;
//     loading.value = false;
//   } catch (error) {
//     notify('error', { detail: error.message });
//   }
// };


const { cacheAction, cache } = useActionsCaching()

const onCellEditComplete = async (event) => {
  let { data, newValue, field } = event;
  data[field] = newValue;
  // const payload = {
  //   id: data.id,
  //   [field]: newValue,
  // }

  // cacheAction({type: 'update', payload})
  
  // try {
  //   const response = await api.update(payload)
    
  //   if (response.success) {
  //     data[field] = newValue;
  //   }
  // } catch (error) {
  //   // event.preventDefault(); // При ошибке на gtsAutoComplete не срабатывает. Не понятно что делать???
  //   notify('error', { detail: error.message }, true);
  // }
};
// const onPage = async (event) => {
//   lazyParams.value = event;
//   await loadLazyData(event);
// };
// const onSort = async (event) => {
//   lazyParams.value = event;
//   await loadLazyData(event);
// };
const format_decimal = (text,FractionDigits) => {
  var parts = parseFloat(text).toFixed(FractionDigits).toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join(",");
  //return parseFloat(text).toFixed(2).toString().replace(".", ",");
};

const lineItem = ref({});
const submitted = ref(false);
const lineItemDialog = ref(false);

//edit row in dialog
const editLineItem = (item) => {
  lineItem.value = { ...item };
  lineItemDialog.value = true;
};
const hideDialog = () => {
  lineItemDialog.value = false;
  submitted.value = false;
};
const saveLineItem = async () => {
  submitted.value = true;

  if (lineItem.value.id) {

    try {
  //     await api.update(lineItem.value)
  
      lineItems.value[findIndexById(Number(lineItem.value.id))] =
      lineItem.value;
      lineItemDialog.value = false;
      lineItem.value = {};
    } catch (error) {
      notify('error', { detail: error.message });
    }
  } else {
    try {
      // await api.create(lineItem.value)
      // refresh()
      let maxid = 0
      lineItems.value.forEach(function(item){
        if(item.id > maxid) maxid = item.id
      })
      lineItem.value.id = maxid + 1
      lineItems.value.push(lineItem.value)
      lineItemDialog.value = false;
      lineItem.value = {};
    } catch (error) {
      notify('error', { detail: error.message });
    }
  }
};
const findIndexById = (id) => {
  let index = -1;
  for (let i = 0; i < lineItems.value.length; i++) {
    if (lineItems.value[i].id === id) {
      index = i;
      break;
    }
  }
  return index;
};

//add row
const openNew = () => {
  lineItem.value = {};
  submitted.value = false;
  lineItemDialog.value = true;
};

//delete row
const deleteLineItemDialog = ref(false);
const deleteLineItemsDialog = ref(false);
const confirmDeleteLineItem = (item) => {
  lineItem.value = item;
  deleteLineItemDialog.value = true;
};
const deleteLineItem = async () => {
  try {
    // await api.delete({ ids: lineItem.value.id })

    // TODO желательно рефрешнуть страницу после удаления ряда
    lineItems.value = lineItems.value.filter(
      (val) => val.id !== lineItem.value.id
    );

    deleteLineItemDialog.value = false;
    lineItem.value = {}
  } catch (error) {
    notify('error', { detail: error.message });
  }
};
const confirmDeleteSelected = () => {
  if (selectedlineItems.value && selectedlineItems.value.length)
    deleteLineItemsDialog.value = true;
};
const deleteSelectedLineItems = async () => {
  // const ids = selectedlineItems.value.map((line) => line.id).join(',');

  try {
    // await api.delete({ ids })

    // TODO желательно рефрешнуть страницу после удаления ряда
    lineItems.value = lineItems.value.filter(
      (val) => !selectedlineItems.value.includes(val)
    );
    deleteLineItemsDialog.value = false;
    selectedlineItems.value = null;
  } catch (error) {
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
const getClass = (col) => {
  if(col.readonly){
    return 'readonly ' + col.type
  }
  return col.type
};
const rowClass = (data) => {
  if(row_setting.value[data.id] && row_setting.value[data.id].class){
    return row_setting.value[data.id].class;
  }
  return
};
const getClassTD = (col) => {
  return col.type
};
const customFields = ref({});
const disableField = (data,field) =>{
  if(customFields.value[data.id]){
    if(customFields.value[data.id][field] && customFields.value[data.id][field].readonly == 1) return true
  }
  return false
}
const getClassBody = (col, data) => {
  let class1 = 'td-body '  + col.type
  let customReadonly = false
  if(customFields.value[data.id]){
    if(customFields.value[data.id][col.field]){
      if(customFields.value[data.id][col.field].readonly == 1) customReadonly = true
    }
  }
  if(col.readonly || customReadonly){
    return class1 + ' readonly'
  }
  return class1
};
</script>


<style>

  td.readonly {
      background-blend-mode: multiply;
      background: rgb(0,0,0,0.1);
  }
  
  /* th.autocomplete,td.autocomplete{
    width: 250px !important;
  }
 */
  th.date,td.date{
    min-width: 150px;
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
  .p-datatable textarea{
    width:136px;
  }

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
</style>
