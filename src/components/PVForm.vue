<template>
  <v-runtime-template 
    v-if="form && form.template" 
    :template="form.template"
    :template-props="templateProps"
  />
  <Tabs v-else-if="form && form.tabs" v-model:value="activeTab">
    <TabList>
      <Tab v-for="(tab, key) in form.tabs" :key="key" :value="key">{{ tab.label }}</Tab>
      <Tab v-if="additionalFields.length > 0" value="additional">Дополнительно</Tab>
    </TabList>
    <TabPanels>
      <TabPanel v-for="(tab, key) in form.tabs" :key="key" :value="key">
        <div :class="{'flex flex-wrap gap-4':inline}">
          <template v-for="col of getTabFields(tab.fields)">
            <div class="flex flex-wrap items-start gap-4 mb-4">
              <label :for="col.field" class="font-semibold w-24 pt-2">
                {{ col.label }}
                <span v-if="isFieldRequired(col)" class="text-red-500 ml-1">*</span>
              </label>
              <div class="flex-1" :style="{ maxWidth: computedFieldWidth }">
                <div :class="{ 'p-invalid': isFieldInvalid(col) }">
                  <EditField
                    :field="col"
                    v-model="model[col.field]"
                    :data="model"
                    :use_data="true"
                    :autocompleteSettings="autocompleteSettings[col.field]"
                    :selectSettings="selectSettings2[col.field]"
                    @set-value="setValue()"
                  />
                </div>
                <small v-if="col.desc" class="block mt-1 text-gray-600">{{ col.desc }}</small>
                <small v-if="isFieldInvalid(col)" class="block mt-1 text-red-500">Поле обязательно для заполнения</small>
              </div>
            </div>
          </template>
        </div>
      </TabPanel>
      <TabPanel v-if="additionalFields.length > 0" value="additional">
        <div :class="{'flex flex-wrap gap-4':inline}">
          <template v-for="col of additionalFields">
            <div class="flex flex-wrap items-start gap-4 mb-4">
              <label :for="col.field" class="font-semibold w-24 pt-2">
                {{ col.label }}
                <span v-if="isFieldRequired(col)" class="text-red-500 ml-1">*</span>
              </label>
              <div class="flex-1" :style="{ maxWidth: computedFieldWidth }">
                <div :class="{ 'p-invalid': isFieldInvalid(col) }">
                  <EditField
                    :field="col"
                    v-model="model[col.field]"
                    :data="model"
                    :use_data="true"
                    :autocompleteSettings="autocompleteSettings[col.field]"
                    :selectSettings="selectSettings2[col.field]"
                    @set-value="setValue()"
                  />
                </div>
                <small v-if="col.desc" class="block mt-1 text-gray-600">{{ col.desc }}</small>
                <small v-if="isFieldInvalid(col)" class="block mt-1 text-red-500">Поле обязательно для заполнения</small>
              </div>
            </div>
          </template>
        </div>
      </TabPanel>
    </TabPanels>
  </Tabs>
  <div v-else :class="{'flex flex-wrap gap-4':inline}">
    <template v-for="col of columns2.filter((x) => x.table_only != true && x.type != 'hidden')">
      <div class="flex flex-wrap items-start gap-4 mb-4">
        <label :for="col.field" class="font-semibold w-24 pt-2">
          {{ col.label }}
          <span v-if="isFieldRequired(col)" class="text-red-500 ml-1">*</span>
        </label>
        <div class="flex-1" :style="{ maxWidth: computedFieldWidth }">
          <div :class="{ 'p-invalid': isFieldInvalid(col) }">
            <EditField
              :field="col"
              v-model="model[col.field]"
              :data="model"
              :use_data="true"
              :autocompleteSettings="autocompleteSettings[col.field]"
              :selectSettings="selectSettings2[col.field]"
              @set-value="setValue()"
            />
          </div>
          <small v-if="col.desc" class="block mt-1 text-gray-600">{{ col.desc }}</small>
          <small v-if="isFieldInvalid(col)" class="block mt-1 text-red-500">Поле обязательно для заполнения</small>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import EditField from "./EditField.vue";
import apiCtor from './api.js'
import { useNotifications } from "./useNotifications";
import VRuntimeTemplate from "vue3-runtime-template-next";
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';

export default {
  name: 'PVForm',
  components: {
    EditField,
    VRuntimeTemplate,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel
  },
  props: {
    modelValue: {
      type: Object,
      default: () => ({})
    },
    columns: {
      type: Object,
      default: () => ({})
    },
    autocompleteSettings: {
      type: Object,
      default: () => ({})
    },
    selectSettings: {
      type: Object,
      default: () => ({})
    },
    customFields: {
      type: Object,
      default: () => ({}),
    },
    inline: {
      type: Boolean,
      default: false
    },
    fieldWidth: {
      type: String,
      default: null // null = auto (18rem/24rem), 'full' = 100%, или любое CSS значение типа '30rem', '400px'
    },
    mywatch: {
      type: Object,
      default: () => ({
        enabled: false,
        fields: [],
        filters: {},
        table: '',
        action: ''
      })
    },
    form: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['update:modelValue', 'set-value'],
  data() {
    return {
      selectSettings2: {},
      columns2: {},
      stop_watch_props: false,
      watchOld: {},
      watch_first: true,
      api: null,
      notify: null,
      activeTab: null,
      usedFieldsInTabs: new Set()
    }
  },
  computed: {
    model: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      }
    },
    templateProps() {
      return {
        EditField,
        model: this.model,
        columns2: this.columns2,
        inline: this.inline,
        autocompleteSettings: this.autocompleteSettings,
        selectSettings2: this.selectSettings2,
        setValue: this.setValue
      }
    },
    availableFields() {
      return this.columns2.filter((x) => x.table_only != true && x.type != 'hidden')
    },
    additionalFields() {
      if (!this.form || !this.form.tabs) return []
      
      return this.availableFields.filter(col => !this.usedFieldsInTabs.has(col.field))
    },
    computedFieldWidth() {
      // Приоритет: form.fieldWidth > fieldWidth prop > default
      const width = this.form?.fieldWidth || this.fieldWidth
      
      if (width === 'full') {
        return '100%'
      } else if (width) {
        return width
      } else {
        return this.inline ? '18rem' : '24rem'
      }
    }
  },
  watch: {
    columns: {
      handler() {
        this.updateColumnsAndSettings()
      },
      deep: true,
      immediate: true
    },
    selectSettings: {
      handler() {
        this.updateColumnsAndSettings()
      },
      deep: true,
      immediate: true
    },
    customFields: {
      handler() {
        this.updateColumnsAndSettings()
      },
      deep: true,
      immediate: true
    },
    model: {
      handler(newVal) {
        if (this.mywatch.enabled) {
          this.mywatch.fields.forEach(field => {
            if ((this.watch_first && newVal[field]) || newVal[field] != this.watchOld[field]) {
              this.watch_form(newVal, field, newVal[field], this.watchOld[field])
            }
          })
          this.watch_first = false
          this.watchOld = JSON.parse(JSON.stringify(newVal))
        }
      },
      deep: true,
      immediate: true
    },
    'form.tabs': {
      handler(newTabs) {
        if (newTabs && !this.activeTab) {
          const firstTabKey = Object.keys(newTabs)[0]
          this.activeTab = firstTabKey || null
        }
      },
      immediate: true
    }
  },
  created() {
    this.api = apiCtor(this.mywatch.table)
    const notifications = useNotifications()
    this.notify = notifications.notify
    
    // Установка активного таба по умолчанию
    if (this.form && this.form.tabs) {
      const firstTabKey = Object.keys(this.form.tabs)[0]
      this.activeTab = firstTabKey || null
    }
  },
  methods: {
    setValue() {
      this.$emit('set-value', this.model)
    },
    isFieldRequired(col) {
      // Проверяем required или needed
      // Учитываем: true, 1, '1' как true
      // Учитываем: false, 0, '0', null, undefined как false
      const required = col.required
      const needed = col.needed
      
      return (required === true || required === 1 || required === '1') ||
             (needed === true || needed === 1 || needed === '1')
    },
    isFieldInvalid(col) {
      // Проверяем только если поле обязательное
      if (!this.isFieldRequired(col)) {
        return false
      }
      
      const value = this.model[col.field]
      
      // Проверка на пустое значение
      if (value === null || value === undefined || value === '' || value === 0) {
        return true
      }
      
      // Для массивов проверяем длину
      if (Array.isArray(value) && value.length === 0) {
        return true
      }
      
      // Для чисел проверяем что это не NaN
      if (typeof value === 'number' && isNaN(value)) {
        return true
      }
      
      return false
    },
    getTabFields(fieldsConfig) {
      if (!fieldsConfig) return []
      
      const fields = []
      const fieldParts = fieldsConfig.split(',').map(f => f.trim())
      
      fieldParts.forEach(part => {
        if (part.includes('-')) {
          // Диапазон индексов: "0-3"
          const [start, end] = part.split('-').map(Number)
          for (let i = start; i <= end && i < this.availableFields.length; i++) {
            const field = this.availableFields[i]
            if (field) {
              fields.push(field)
              this.usedFieldsInTabs.add(field.field)
            }
          }
        } else if (!isNaN(part)) {
          // Одиночный индекс: "6"
          const index = Number(part)
          const field = this.availableFields[index]
          if (field) {
            fields.push(field)
            this.usedFieldsInTabs.add(field.field)
          }
        } else {
          // Имя поля: "id", "name"
          const field = this.availableFields.find(f => f.field === part)
          if (field) {
            fields.push(field)
            this.usedFieldsInTabs.add(field.field)
          }
        }
      })
      
      return fields
    },
    async updateColumnsAndSettings() {
      if (this.stop_watch_props) return
      
      this.selectSettings2 = JSON.parse(JSON.stringify(this.selectSettings))
      this.columns2 = JSON.parse(JSON.stringify(this.columns))
      
      for (let col in this.columns2) {
        if (this.columns2[col].hasOwnProperty('default')) {
          if (!this.model.hasOwnProperty(this.columns2[col].field)) {
            this.model[this.columns2[col].field] = this.columns2[col].default
          }
        }
        
        if (this.columns2[col].select_data) {
          if (!this.selectSettings2[this.columns2[col].field]) {
            this.selectSettings2[this.columns2[col].field] = {}
          }
          this.selectSettings2[this.columns2[col].field].rows = this.columns2[col].select_data
        }
        
        if (this.customFields.hasOwnProperty(this.columns2[col].field)) {
          let cf = this.customFields[this.columns2[col].field]
          
          this.columns2[col] = { ...this.columns2[col], ...cf }
          
          if (cf.readonly == 1) {
            this.columns2[col].readonly = true
          } else {
            this.columns2[col].readonly = false
          }
          
          if (cf.select_data) {
            if (!this.selectSettings2[this.columns2[col].field]) {
              this.selectSettings2[this.columns2[col].field] = {}
            }
            this.selectSettings2[this.columns2[col].field].rows = cf.select_data
          }
        }
        
        if (this.columns2[col].type == 'boolean') {
          if (this.model[this.columns2[col].field] == "1") {
            this.model[this.columns2[col].field] = true
          }
        }
      }
    },
    async watch_form(values, field, value, oldValue) {
      try {
        const response = await this.api.action('watch_form', {
          filters: this.mywatch.filters,
          watch_action: this.mywatch.action,
          values: values,
          field: field,
          value: value,
          oldValue: oldValue
        })
        
        if (!response.success) {
          this.notify('error', { detail: response.message }, true)
          return
        }
        
        if (response.data.fields) {
          this.stop_watch_props = true
          let cols = []
          let fields = response.data.fields
          
          for (let field in fields) {
            fields[field].field = field
            if (!fields[field].hasOwnProperty("label")) {
              fields[field].label = field
            }
            if (!fields[field].hasOwnProperty("type")) {
              fields[field].type = "text"
            }
            if (fields[field].hasOwnProperty("readonly")) {
              if (fields[field].readonly === true || fields[field].readonly == 1) {
                fields[field].readonly = true
              } else {
                fields[field].readonly = false
              }
            }
            if (fields[field].select_data) {
              if (!this.selectSettings2[field]) {
                this.selectSettings2[field] = {}
              }
              this.selectSettings2[field].rows = fields[field].select_data
            }
            cols.push(fields[field])
          }
          
          this.columns2 = cols
          
          for (let col in this.columns2) {
            if (this.columns2[col].hasOwnProperty('default')) {
              if (!this.model[this.columns2[col].field]) {
                this.model[this.columns2[col].field] = this.columns2[col].default
              }
            }
          }
        }
      } catch (error) {
        this.notify('error', { detail: error.message }, true)
      }
    }
  }
}
</script>

<style>
  .p-inputnumber-input {
    width: 100% !important;
  }
</style>
