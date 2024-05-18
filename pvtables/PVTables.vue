<template>
  <div class="card">
    <Toolbar class="p-mb-4">
      <template #start>
        <Button
          v-for="action in actions.filter((x) => x.head)"
          :icon="action.icon"
          :label="action.label"
          :class="action.class"
          @click="action.head_click"
        />
      </template>
      <template #end>
        <Button
          icon="pi pi-refresh"
          class="p-button-rounded p-button-success"
          @click="refresh"
        />
        <Button
          type="button"
          icon="pi pi-filter-slash"
          @click="clearFilter()"
        />
      </template>
    </Toolbar>
    <DataTable
      :value="lineItems"
      lazy

      paginator
      :first="first"
      :rows="10"
      :rowsPerPageOptions="[10, 60, 30, 10]"

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
      
      v-model:expandedRows="expandedRows"
      showGridlines
    >
      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
      <template
        v-for="col of columns.filter((x) => x.modal_only != true)"
        :key="col.field"
      >
        <Column
          v-if="col.field == 'id'"
          field="id"
          header="id"
          style="padding: 1rem 10px 1rem 10px"
          sortable
        >
          <template #body="{ data, field }">
            {{ data[field] }}
          </template>
        </Column>
        <Column
          v-else-if="col.type == 'autocomplete'"
          :field="col.field"
          :header="col.label"
          :class="getClass(col)"
          :style='{"min-width": "350px"}'
          sortable
        >
          <template #body="{ data, field }">
            <GTSAutocomplete
              :table="col.table"
              v-model:id="data[field]"
              :options="autocompleteSettings[field]?.rows"
              @set-value="
                onCellEditComplete({ data, field, newValue: data[field] })
              "
              :disabled="col.readonly"
            />
          </template>
          <template #filter="{ filterModel }">
            <InputText
              v-model="filterModel.value"
              type="text"
              class="p-column-filter"
              :placeholder="filterPlaceholder(col)"
            />
          </template>
        </Column>
        <Column
          v-else
          :field="col.field"
          :header="col.label"
          :class="getClass(col)"
          :style='{"min-width": "350px"}'
          sortable
        >
          <template #body="{ data, field }">
            <template v-if="col.type == 'decimal'" >
              {{ replace_point(data[field]) }}
            </template>
            <InputSwitch 
              v-else-if="col.type == 'boolean'" 
              v-model="data[field]" 
              @keydown.tab.stop
              @change="onCellEditComplete({ data, field, newValue: data[field] })"
              :disabled="col.readonly"
            />
            <GTSDate 
              v-else-if="col.type === 'date'" 
              :model-value="data[field]"
              @update:modelValue="($event) => onCellEditComplete({ data, field, newValue: $event })"
              :disabled="col.readonly"
            />
            <template v-else>
              {{ data[field] }}
            </template>
          </template>
          <template v-if="!['boolean', 'date'].includes(col.type) && !col.readonly" #editor="{ data, field }">
            <Textarea v-if="col.type == 'textarea'" v-model="data[field]" rows="1" />
            <InputNumber v-else-if="col.type == 'number'" v-model="data[field]" />
            <InputNumber
              v-else-if="col.type == 'decimal'"
              v-model="data[field]"
              :minFractionDigits="col.FractionDigits"
              :maxFractionDigits="col.FractionDigits"
            />
            <InputText v-else v-model="data[field]" />
          </template>

          <template #filter="{ filterModel }">
            <InputText
              v-model="filterModel.value"
              type="text"
              class="p-column-filter"
              :placeholder="filterPlaceholder(col)"
            />
          </template>
        </Column>
      </template>
      <Column
        v-if="actions_row"
        :exportable="false"
        style="white-space: nowrap"
      >
        <template #body="slotProps">
          <Button
            v-for="action in actions.filter((x) => x.row)"
            :icon="action.icon"
            :class="action.class"
            @click="action.click(slotProps.data, columns)"
          />
        </template>
      </Column>
      <template #expansion="slotProps">
        <div class="p-3">
          <PVTables
            :table="subtables[slotProps.data.id]"
            :filters="subfilters[slotProps.data.id]"
          />
        </div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="lineItemDialog"
      :style="{ width: '450px' }"
      header="Редактировать"
      :modal="true"
      class="p-fluid"
    >
      <template v-for="col of columns.filter((x) => x.table_only != true)">
        <div class="p-field">
          <label :for="col.field">{{ col.label }}</label>
          <template v-if="col.field == 'id'">
            <p :id="col.field">{{ lineItem[col.field] }}</p>
          </template>
          <template v-else-if="col.type == 'textarea'">
            <Textarea :id="col.field" v-model.trim="lineItem[col.field]" :disabled="col.readonly"/>
          </template>
          <template v-else-if="col.type == 'number'">
            <InputNumber :id="col.field" v-model="lineItem[col.field]" :disabled="col.readonly"/>
          </template>
          <template v-else-if="col.type == 'autocomplete'">
            <GTSAutocomplete
              v-model:id="lineItem[col.field]"
              :table="col.table"
              :options="autocompleteSettings[col.field]?.rows"
              :disabled="col.readonly"
            />
          </template>
          <template v-else-if="col.type == 'decimal'">
            <InputNumber
              :id="col.field"
              v-model="lineItem[col.field]"
              :minFractionDigits="col.FractionDigits"
              :maxFractionDigits="col.FractionDigits"
              :disabled="col.readonly"
            />
          </template>
          <template v-else-if="col.type == 'boolean'">
            <InputSwitch :id="col.field" v-model="lineItem[col.field]" :disabled="col.readonly"/>
          </template>
          <GTSDate v-else-if="col.type === 'date'" v-model="lineItem[col.field]" :disabled="col.readonly"/>
          <template v-else>
            <InputText :id="col.field" v-model.trim="lineItem[col.field]" :disabled="col.readonly"/>
          </template>
        </div>
      </template>

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
      :style="{ width: '450px' }"
      header="Confirm"
      :modal="true"
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
      :style="{ width: '450px' }"
      header="Confirm"
      :modal="true"
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
</template>

<script setup>
import { ref, onMounted, defineComponent, readonly } from "vue";
defineComponent({
  name: "PVTables",
});
import DataTable from "primevue/datatable";
import Column from "primevue/column";

import Button from "primevue/button";
import Toolbar from "primevue/toolbar";
import Dialog from "primevue/dialog";
// import axios from "axios";

//import fields component
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import InputNumber from "primevue/inputnumber";
import InputSwitch from "primevue/inputswitch";
// import ToggleButton from 'primevue/togglebutton';
import { FilterMatchMode, FilterOperator } from "primevue/api";

import GTSDate from "pvtables/gtsdate";
import GTSAutocomplete from "pvtables/gtsautocomplete";
import { useNotifications } from "pvtables/notify";

import { useActionsCaching } from "./composables/useActionsCaching";
import apiCtor from 'pvtables/api'
import { rowsHandler } from "./core/helpers";

const props = defineProps({
  table: {
    type: String,
    required: true,
  },
  actions: {
    type: Object,
  },
  reload: {
    type: Boolean,
  },
  filters: {
    type: Object,
    default: {},
  },
});

const api = apiCtor(props.table)

const { notify } = useNotifications();

//filters
const filters = ref();

const initFilters = () => {
  let filters0 = {};
  for (let field in fields) {
    if (props.filters.hasOwnProperty(field)) {
      filters0[field] = props.filters[field];
    } else {
      switch (fields[field].type) {
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
const onFilter = async (event) => {
  lazyParams.value.filters = filters.value;
  await loadLazyData(event);
};
const clearFilter = async () => {
  initFilters();
  lazyParams.value.filters = filters.value;
  await loadLazyData();
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
let fields = {};
const lineItems = ref();
// const countRow  = ref(60);
let actions = ref([]);
const actions_row = ref(false);
const actions_head = ref(false);
const globalFilterFields = ref([]);

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
      let filter_fields = [];
      let cols = [];
      for (let field in fields) {
        fields[field].field = field;
        if (!fields[field].hasOwnProperty("label")) {
          fields[field].label = field;
        }
        if (!fields[field].hasOwnProperty("type")) fields[field].type = "text";
        if (fields[field].hasOwnProperty("readonly")){
          if(fields[field].readonly === true || fields[field].readonly == 1){
            fields[field].readonly = true
          }else{
            fields[field].readonly = false
          }
        } 
        cols.push(fields[field]);
        filter_fields.push(field);
      }

      globalFilterFields.value = filter_fields;
      initFilters();

      let actions0 = response.data.actions;

      for (let action in props.actions) {
        actions0[action] = props.actions[action];
      }
      for (let action in actions0) {
        let tmp = { ...actions0[action] };
        let addtmp = true;
        tmp.action = action;
        switch (action) {
          case "update":
            if (!tmp.hasOwnProperty("row")) tmp.row = true;
            if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-pencil";
            if (!tmp.hasOwnProperty("class"))
              tmp.class = "p-button-rounded p-button-success";
            if (!tmp.hasOwnProperty("click"))
              tmp.click = (data) => editLineItem(data);
            break;
          case "delete":
            if (!tmp.hasOwnProperty("row")) tmp.row = true;
            if (!tmp.hasOwnProperty("head")) tmp.head = true;
            if (!tmp.hasOwnProperty("icon")) tmp.icon = "pi pi-trash";
            if (!tmp.hasOwnProperty("class"))
              tmp.class = "p-button-rounded p-button-danger";
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
              tmp.class = "p-button-rounded p-button-success";
            if (!tmp.hasOwnProperty("head_click"))
              tmp.head_click = () => openNew();
            // if(!tmp.hasOwnProperty('head_disabled')) tmp.head_disabled = false
            if (!tmp.hasOwnProperty("label")) tmp.label = "Создать";
            break;
          case "subtables":
            addtmp = false;
            for (let tmptable in actions0[action]) {
              let tmpt = { ...actions0[action][tmptable] };
              // tmpt.action = action
              tmpt.table = tmptable;
              if (!tmpt.hasOwnProperty("row")) tmpt.row = true;
              if (!tmpt.hasOwnProperty("icon")) tmpt.icon = "pi pi-angle-right";
              if (!tmpt.hasOwnProperty("class"))
                tmpt.class = "p-button-rounded p-button-success";
              if (!tmpt.hasOwnProperty("click"))
                tmpt.click = (event) => setExpandedRow(event, tmpt);
              actions_row.value = true;
              actions.value.push(tmpt);
            }
            break;
        }
        if (addtmp) {
          if (tmp.hasOwnProperty("row")) actions_row.value = true;
          if (tmp.hasOwnProperty("row")) actions_head.value = true;
          actions.value.push(tmp);
        }
        // console.log('actions.value',actions.value)
      }
      // await din_import()
      columns.value = cols;
    }

    await loadLazyData();
  } catch (error) {
    notify('error', { detail: error.message }, true);
  }
});

//expand row
const expandedRows = ref({});
const subtables = ref({});
const subfilters = ref({});
const delExpand = async (tmp) => {
  expandedRows.value = { ...tmp };
};
const setExpandedRow = async (event, tmpt) => {
  let tmp = { ...expandedRows.value };
  if (tmp.hasOwnProperty(event.id)) {
    if (subtables.value[event.id] == tmpt.table) {
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
  subtables.value[event.id] = tmpt.table;

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
  expandedRows.value = { ...tmp };
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

const loadLazyData = async (event) => {
  loading.value = true;
  lazyParams.value = {
    ...lazyParams.value,
    first: event?.first || first.value,
  };
  // console.log('lazyParams.value',lazyParams.value)
  // console.log('event',event)
  let params = {
    limit: lazyParams.value.rows,
    setTotal: 1,
    offset: lazyParams.value.first,
    // sortField:lazyParams.value.sortField,
    // sortOrder:lazyParams.value.sortOrder,
    multiSortMeta: lazyParams.value.multiSortMeta,
    filters: filters.value,
  };
 
  try {
    const response = await api.read(params)
    
    
    lineItems.value = rowsHandler(response.data.rows, fields)

    // TODO переход на другую страницу не имеет нужных данных, здесь ошибка
    // нужно или глубоко мёржить данные с имеющимися,
    // или отдавать полные данные для автокомплита на запрос каждой страницы
    for(let af in response.data.autocomplete){
      autocompleteSettings.value[af] = response.data.autocomplete[af];
    }
      

    //

    totalRecords.value = response.data.total;
    loading.value = false;
  } catch (error) {
    notify('error', { detail: error.message });
  }
};
const refresh = () => {
  loadLazyData();
};
defineExpose({ refresh });

const { cacheAction, cache } = useActionsCaching()

const onCellEditComplete = async (event) => {
  let { data, newValue, field } = event;

  const payload = {
    id: data.id,
    [field]: newValue,
  }

  cacheAction({type: 'update', payload})
  
  try {
    const response = await api.update(payload)
    
    if (response.success) {
      data[field] = newValue;
    }
  } catch (error) {
    // event.preventDefault(); // При ошибке на gtsAutoComplete не срабатывает. Не понятно что делать???
    notify('error', { detail: error.message }, true);
  }
};
const onPage = async (event) => {
  lazyParams.value = event;
  await loadLazyData(event);
};
const onSort = async (event) => {
  lazyParams.value = event;
  await loadLazyData(event);
};
const replace_point = (text) => {
  return text.toString().replace(".", ",");
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
      await api.update(lineItem.value)
  
      lineItems.value[findIndexById(Number(lineItem.value.id))] =
      lineItem.value;
      lineItemDialog.value = false;
      lineItem.value = {};
    } catch (error) {
      notify('error', { detail: error.message });
    }
  } else {
    try {
      await api.create(lineItem.value)
      refresh()
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
    await api.delete({ ids: lineItem.value.id })

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
  const ids = selectedlineItems.value.map((line) => line.id).join(',');

  try {
    await api.delete({ ids })

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
    return 'readonly'
  }
};
</script>

<style>
  td.readonly{
    background-color:#b9b9b9
  }
</style>