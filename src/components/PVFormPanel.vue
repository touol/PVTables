<template>
    <div>
        
        <PVForm 
            v-model="Item" 
            :columns="columns" 
            :mywatch="mywatch"
            :form="form"
            @set-value="onFieldChanged"
        />
        <div class="flex gap-2 items-center">
          <Button
            label="Сохранить"
            icon="pi pi-check"
            class="p-button-text"
            @click="saveItem()"
            />
          <span v-if="autosave" class="pvform-autosave">{{ autosaveStatus }}</span>
          <Button
            v-if="saveVersionRow && (Item && Item.id || props.current_id)"
            label="Версии" icon="pi pi-history"
            class="p-button-sm p-button-text"
            @click="versionsDialog = true"
            />
        </div>
    </div>
    <RowVersionsDialog
      v-if="saveVersionRow"
      v-model:visible="versionsDialog"
      :table="props.table"
      :rowId="Item && Item.id ? Item.id : props.current_id"
      :columns="columns"
      @restored="onVersionRestored"
    />
    <Toast/>
</template>

<script setup>
    import PVForm from './PVForm.vue'
    import Toast from './PVToast.vue'  // синглтон: один тостер на страницу
    import Button from "primevue/button";
    import apiCtor from './api'
    import RowVersionsDialog from './RowVersionsDialog.vue'
    import { useNotifications } from "./useNotifications";

    import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

    const props = defineProps({
        table: {
            type: String,
            required: true,
        },
        current_id:{
            type: [Number,String],
            default: 0
        }
    });
    let api = apiCtor(props.table)
    const { notify } = useNotifications();

    onMounted(() => {
        loadForm()
    })

    watch(
        () => props,
        async () => {
            await flushAutosave()
            await loadForm()
        },{deep:true}
    )
    const Item = ref({})
    let fields = {}
    const columns = ref([{field:'id',label:'id',type:'text'}])
    const form = ref({})
    const versionsDialog = ref(false)
    const saveVersionRow = ref(false)

    const loadForm = async () => { /* logic to load tree data */ 
        try {
            api = apiCtor(props.table)
            const response = await api.options()
            // console.log('response.data',response.data)
            fields = response.data.fields;
            if(response.data.form){
                form.value = response.data.form
            }
            if(response.data.save_version_row) saveVersionRow.value = true
            columns.value = setCollumns(fields)
            if(props.current_id > 0){
                const data = await api.get(props.current_id)
                Item.value = data
            }
            
            // console.log('columns.value',columns.value)
        } catch (error) {
            notify('error', { detail: error.message }, true);
        }
    }
    const setCollumns = (fields) => {
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
        }
        return cols
    }
    
    const emit = defineEmits(['update-treenode-title']);

    // ── Автосохранение ───────────────────────────────────────────────────
    // Карточка длиннее экрана: тянуться за кнопкой «Сохранить» вниз неудобно,
    // и правку легко потерять, переключившись на другого в дереве.
    // Включается у таблицы: properties.form.autosave = true.
    const autosave = computed(() => !!(form.value && form.value.autosave))
    const autosaveStatus = ref('')
    let autosaveTimer = null
    let pending = false

    const onFieldChanged = () => {
        if (!autosave.value) return
        pending = true
        autosaveStatus.value = 'Изменено'
        // Правка приходит на каждый символ — сохраняем, когда человек остановился
        clearTimeout(autosaveTimer)
        autosaveTimer = setTimeout(() => saveItem(true), 900)
    }
    // Несохранённое при уходе с карточки: смена записи, вкладки, закрытие страницы
    const flushAutosave = async () => {
        if (!autosave.value || !pending) return
        clearTimeout(autosaveTimer)
        await saveItem(true)
    }
    const beforeUnload = (e) => {
        if (!autosave.value || !pending) return
        flushAutosave()
        e.preventDefault()
        e.returnValue = ''
    }
    onMounted(() => window.addEventListener('beforeunload', beforeUnload))
    onBeforeUnmount(() => {
        window.removeEventListener('beforeunload', beforeUnload)
        flushAutosave()
    })

    const saveItem = async (auto = false) => {
        try {
            if (auto) {
                // Id ещё нет — сохранять нечего: запись создаётся кнопкой
                if (!(Item.value && Item.value.id) && !props.current_id) return
                autosaveStatus.value = 'Сохраняю…'
            }
            const response = await api.update(Item.value,{})
            if (!response.success) {
                if (auto) autosaveStatus.value = 'Не сохранено'
                notify('error', { detail: response.message }, true);
            }else{
                if(response.data.uniTreeTable){
                    let uniTreeTable = response.data.uniTreeTable
                    emit('update-treenode-title',{uniTreeTable})
                }
                let uniTreeTable = null
                emit('update-treenode-title',{uniTreeTable})
                pending = false
                // Тост на каждую правку поля — шум; автосохранение отчитывается строкой у кнопки
                if (auto) {
                    const d = new Date()
                    autosaveStatus.value = 'Сохранено в ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
                } else {
                    notify('success', { detail: response.message }, true);
                }
            }
        } catch (error) {
            if (auto) autosaveStatus.value = 'Не сохранено'
            notify('error', { detail: error.message });
        }
    }
    const onVersionRestored = () => { loadForm() }

    const mywatch = ref({
        enabled: false,
        fields: [],
        table: '',
        action: ''
    });
</script>

<style>
  .pvform-autosave {
    font-size: .85rem;
    color: var(--p-text-muted-color, #64748b);
  }
</style>
