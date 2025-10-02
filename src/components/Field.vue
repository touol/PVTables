<template>
    <!-- Кастомный Vue шаблон, если указан и не в режиме редактирования -->
    <component 
        v-if="compiledTemplate && !isEditing" 
        :is="compiledTemplate" 
        :value="model"
        :field="col"
        :row="data"
        :data="data"
        @click="startEditing"
    />
    <!-- Стандартные поля -->
    <template v-else-if="col.field == 'id'">
        {{ model }}
    </template>
    <PVAutoComplete
        v-else-if="col.type == 'autocomplete'"
        :field="col"
        v-model="model"
        :options="autocompleteSettings"
        @set-value="setValue(); stopEditing()"
        :disabled="use_readonly && col.readonly"
    />
    <PVMultiAutoComplete
        v-else-if="col.type == 'multiautocomplete'"
        v-model="model"
        :field="col"
        :options="autocompleteSettings"
        @set-value="setValue(); stopEditing()"
        :disabled="use_readonly && col.readonly"
    />
    <PVMultiple
        v-else-if="col.type == 'multiple'"
        v-model="model"
        :field="col"
        :data="data"
        @set-value="setValue(); stopEditing()"
        :disabled="use_readonly && col.readonly"
    />
    <GTSSelect
        v-else-if="col.type == 'select'"
        v-model:id="model"
        :options="selectSettings2?.rows"
        @set-value="setValue(); stopEditing()"
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
        @update:modelValue="($event) => { updateValue($event); stopEditing(); }"
        :disabled="use_readonly && col.readonly"
    />
    <ToggleSwitch 
        v-else-if="col.type == 'boolean'"
        v-model="model" 
        @keydown.tab.stop
        @change="setValue(); stopEditing()"
        :disabled="use_readonly && col.readonly"
    />
    <FileSelector
        v-else-if="col.type == 'file'"
        v-model="model"
        :mediaSource="col.mediaSource"
        placeholder="Выберите файл"
        @fileSelected="($event) => { updateValue($event); stopEditing(); }"
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
    import { ref, watchEffect, computed } from "vue";
    import { compile } from "vue";
    // import InputText from "primevue/inputtext";
    // import Textarea from "primevue/textarea";
    // import InputNumber from "primevue/inputnumber";
    import ToggleSwitch from 'primevue/toggleswitch';
    // import Checkbox from 'primevue/checkbox';

    import GTSDate from "./gtsDate.vue";
    import PVAutoComplete from "./PVAutoComplete.vue";
    import PVMultiAutoComplete from "./PVMultiAutoComplete.vue";
    import PVMultiple from "./PVMultiple.vue";
    import GTSSelect from "./gtsSelect.vue";
    import FileSelector from './filebrowser/FileSelector.vue';
    import { useNotifications } from "./useNotifications.js";

    const { notify } = useNotifications();

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

    // Компиляция кастомного шаблона
    const compiledTemplate = computed(() => {
        if (!col.value.template) return null;
        
        // Валидация шаблона перед компиляцией
        if (!validateTemplate(col.value.template)) {
            console.error('Шаблон содержит потенциально опасные конструкции');
            notify('error', { detail: 'Шаблон содержит потенциально опасные конструкции и не может быть использован' });
            return null;
        }
        
        try {
            const compiledRender = compile(col.value.template);
            
            // Создаем компонент с правильным контекстом
            return {
                render: compiledRender,
                props: ['value', 'field', 'row', 'data'],
                emits: ['click'],
                setup(props, { emit }) {
                    // Предоставляем методы и переменные для шаблона
                    return {
                        startEditing: () => {
                            emit('click');
                        },
                        // Добавляем другие методы, которые могут понадобиться в шаблоне
                        setValue,
                        updateValue,
                        format_decimal,
                        getField,
                        // Предоставляем доступ к emit под безопасным именем
                        emitEvent: emit
                    };
                }
            };
        } catch (error) {
            console.error('Ошибка компиляции шаблона:', error);
            notify('error', { detail: `Ошибка в шаблоне: ${error.message}` });
            return null;
        }
    });

    const col = ref({})
    const selectSettings2 = ref({})
    const isEditing = ref(false)
    watchEffect(async () => {
        selectSettings2.value = JSON.parse(JSON.stringify(props.selectSettings)) //props.selectSettings}
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
    
    const startEditing = () => {
        isEditing.value = true
    }
    
    const stopEditing = () => {
        isEditing.value = false
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
