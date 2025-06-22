<template>
    <template v-if="col.field == 'id'">
        <span 
            class="w-full" autocomplete="off">
            {{ model }}
        </span>
    </template>
    <PVAutoComplete
        v-else-if="col.type == 'autocomplete'"
        :field="col"
        v-model="model"
        :options="autocompleteSettings"
        @set-value="setValue()"
        :disabled="use_readonly && col.readonly"
        class="w-full" autocomplete="off"
    />
    <GTSSelect
        v-else-if="col.type == 'select'"
        v-model:id="model"
        :options="selectSettings2?.rows"
        @set-value="setValue()"
        :disabled="use_readonly && col.readonly"
        class="w-full" autocomplete="off"
    />
    <InputNumber
        v-else-if="col.type == 'decimal'"
        :id="col.field"
        v-model="model"
        @change="setValue()"
        :minFractionDigits="col.FractionDigits"
        :maxFractionDigits="col.FractionDigits"
        :disabled="use_readonly && col.readonly"
        class="w-full" autocomplete="off"
    />
    <InputNumber 
        v-else-if="col.type == 'number'" 
        v-model="model"
        @change="setValue()"
        :disabled="use_readonly && col.readonly"
        class="w-full" autocomplete="off"
    />
    <GTSDate
        v-else-if="col.type == 'date'"
        :model-value="model"
        @update:modelValue="($event) => updateValue($event)"
        :disabled="use_readonly && col.readonly"
        class="w-full" autocomplete="off"
    />
    <ToggleSwitch 
        v-else-if="col.type == 'boolean'"
        v-model="model" 
        @keydown.tab.stop
        @change="setValue()"
        :disabled="use_readonly && col.readonly"
    />
    <Textarea 
        v-else-if="col.type == 'textarea'" 
        v-model="model"
        @change="setValue()"
        :disabled="use_readonly && col.readonly"
        class="w-full" autocomplete="off"
    />
    <FileSelector
        v-else-if="col.type == 'file'"
        v-model="model"
        :mediaSource="col.mediaSource"
        placeholder="Выберите файл"
        @fileSelected="($event) => updateValue($event)"
        :disabled="use_readonly && col.readonly"
    />
    <template v-else-if="col.type == 'html'">
        <span v-html="model" class="w-full"></span>
    </template>
    <InputText 
        v-else 
        v-model="model"
        @change="setValue()" 
        :disabled="use_readonly && col.readonly"
        class="w-full" autocomplete="off"
    />
</template>
<script setup>
    import { ref, watchEffect } from "vue";
    import InputText from "primevue/inputtext";
    import Textarea from "primevue/textarea";
    import InputNumber from "primevue/inputnumber";

    import ToggleSwitch from 'primevue/toggleswitch';
    // import Checkbox from 'primevue/checkbox';

    import GTSDate from "./gtsDate.vue";
    import PVAutoComplete from "./PVAutoComplete.vue";
    import GTSSelect from "./gtsSelect.vue";
    import FileSelector from './filebrowser/FileSelector.vue';

    const model = defineModel({
        type: [String,Number,Boolean,Date],
        default: '',
    });

    const props = defineProps({
        field: {
            type: Object,
            required: true,
        },
        data: {
            type: Object,
            default: null,
        },
        use_data: {
            type: Boolean,
            default: false,
        },
        autocompleteSettings: {
            type: Object,
            default: {},
        },
        selectSettings: {
            type: Object,
            default: {},
        },
        customFields: {
            type: Object,
            default: {},
        },
        use_readonly:{
            type: Boolean,
            default: true,
        }
    });
    const col = ref({})
    const selectSettings2 = ref({})
    watchEffect(async () => {
        selectSettings2.value = JSON.parse(JSON.stringify(props.selectSettings)) //props.selectSettings
        if (props.customFields.hasOwnProperty(props.field.field)){
            let cf = props.customFields[props.field.field]
            if(cf.readonly == 1){
                cf.readonly = true
            }else{
                cf.readonly = false
            }
            if(cf.select_data){
                selectSettings2.value.rows = cf.select_data
            }
            col.value = {...props.field,...cf}
        }else{
            col.value = {...props.field}
        }
        if(props.use_data){
            model.value = getField(props.data,col.value.field)
        }
        if(col.value.type == 'boolean'){
            if(model.value == "1") model.value = true
        }
    })
    const emit = defineEmits(['set-value']);
    const setValue = () => {
        emit('set-value', model.value)
    }
    const updateValue = ($evt) => {
        model.value = $evt;
        emit('set-value', model.value)
    }
    const format_decimal = (text,FractionDigits) => {
        if(text == '') text = 0
        var parts = parseFloat(text).toFixed(FractionDigits).toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return parts.join(",");
    }
    function getField(obj, field) {
      return field.split('.').reduce((acc, curr) => acc[curr], obj);
    }
</script>