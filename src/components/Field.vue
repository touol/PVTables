<template>
    <template v-if="col.field == 'id'">
        {{ model }}
    </template>
    <PVAutoComplete
        v-else-if="col.type == 'autocomplete'"
        :field="col"
        v-model="model"
        :options="autocompleteSettings"
        @set-value="setValue()"
        :disabled="use_readonly && col.readonly"
    />
    <GTSSelect
        v-else-if="col.type == 'select'"
        v-model:id="model"
        :options="selectSettings?.rows"
        @set-value="setValue()"
        :disabled="use_readonly && col.readonly"
    />
    <template v-else-if="col.type == 'decimal'">
        {{ format_decimal(model,col.FractionDigits) }}
    </template>
    <template v-else-if="col.type == 'number'">
        {{ model }}
    </template>
    <GTSDate
        v-else-if="col.type == 'date'"
        :model-value="model"
        @update:modelValue="($event) => updateValue($event)"
        :disabled="use_readonly && col.readonly"
    />
    <ToggleSwitch 
        v-else-if="col.type == 'boolean'"
        v-model="model" 
        @keydown.tab.stop
        @change="setValue()"
        :disabled="use_readonly && col.readonly"
    />
    <template v-else-if="col.type == 'html'">
        <span v-html="model"></span>
    </template>
    <template v-else>
        {{ model }}
    </template>
</template>
<script setup>
    import { ref, watchEffect } from "vue";
    // import InputText from "primevue/inputtext";
    // import Textarea from "primevue/textarea";
    // import InputNumber from "primevue/inputnumber";
    import ToggleSwitch from 'primevue/toggleswitch';
    // import Checkbox from 'primevue/checkbox';

    import GTSDate from "./gtsDate.vue";
    import PVAutoComplete from "./PVAutoComplete.vue";
    import GTSSelect from "./gtsSelect.vue";

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
            type: [String,Number,Boolean,Date],
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
    // const selectSettings = ref({})
    watchEffect(async () => {
        // selectSettings.value = {...props.selectSettings}
        if (props.customFields.hasOwnProperty(props.field.field)){
            let cf = props.customFields[props.field.field]
            if(cf.readonly == 1){
                cf.readonly = true
            }else{
                cf.readonly = false
            }
            if(cf.select_data){
                props.selectSettings.rows = cf.select_data
            }
            col.value = {...props.field,...cf}
        }else{
            col.value = {...props.field}
        }
        if(props.use_data) model.value = props.data
        if(col.value.type == 'boolean'){
            if(model.value == "1") model.value = true
        }
    })
    const emit = defineEmits(['set-value']);
    const setValue = () => {
        emit('set-value', model.value)
    }
    const updateValue = ($evt) => {
        model.value = $evt.value;
        emit('set-value', model.value)
    }
    const format_decimal = (text,FractionDigits) => {
        if(text == '') text = 0
        var parts = parseFloat(text).toFixed(FractionDigits).toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return parts.join(",");
    }
</script>