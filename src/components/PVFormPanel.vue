<template>
    <div>
        
        <PVForm 
            v-model="Item" 
            :columns="columns" 
            :mywatch="mywatch"
        />
        <Button
          label="Сохранить"
          icon="pi pi-check"
          class="p-button-text"
          @click="saveItem"
          />
    </div>
    <Toast/>
</template>

<script setup>
    import PVForm from './PVForm.vue'
    import Toast from 'primevue/toast';
    import Button from "primevue/button";
    import apiCtor from './api'
    import { useNotifications } from "./useNotifications";

    import { ref, watch, onMounted } from 'vue';

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
            await loadForm()
        },{deep:true}
    )
    const Item = ref({})
    let fields = {}
    const columns = ref([{field:'id',label:'id',type:'text'}])
    
    const loadForm = async () => { /* logic to load tree data */ 
        try {
            api = apiCtor(props.table)
            const response = await api.options()
            // console.log('response.data',response.data)
            fields = response.data.fields;
            
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
    const saveItem = async () => {
        try {
            const response = await api.update(Item.value,{})
            if (!response.success) {
                notify('error', { detail: response.message }, true);
            }else{
                if(response.data.uniTreeTable){
                    let uniTreeTable = response.data.uniTreeTable
                    emit('update-treenode-title',{uniTreeTable})
                }
                let uniTreeTable = null
                emit('update-treenode-title',{uniTreeTable})
                notify('success', { detail: response.message }, true);
            }
        } catch (error) {
            notify('error', { detail: error.message });
        }
    }
    const mywatch = ref({
        enabled: false,
        fields: [],
        table: '',
        action: ''
    });
</script>


