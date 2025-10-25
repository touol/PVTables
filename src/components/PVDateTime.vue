<template>
  <div>
    <DatePicker 
      v-model="computedDateTime" 
      showIcon 
      :showOnFocus="false" 
      :disabled="disabled"
      :showTime="showTime"
      :hourFormat="hourFormat"
      :timeOnly="timeOnly"
    />
  </div>
</template>

<script setup>
import DatePicker from 'primevue/datepicker';
import { computed } from "vue";

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  showTime: {
    type: Boolean,
    default: true,
  },
  hourFormat: {
    type: String,
    default: '24',
    validator: (value) => ['12', '24'].includes(value)
  },
  timeOnly: {
    type: Boolean,
    default: false,
  }
})

const emit = defineEmits(['update:modelValue'])

const computedDateTime = computed({
  get() {
    if (!props.modelValue) return null;
    
    // Парсим MySQL формат: 2025-09-07 12:01:03
    const mysqlRegex = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/;
    const match = props.modelValue.match(mysqlRegex);
    
    if (!match) return null;
    
    const [, year, month, day, hours = '00', minutes = '00', seconds = '00'] = match;
    
    // Создаем объект Date
    return new Date(
      parseInt(year),
      parseInt(month) - 1, // месяцы в JS начинаются с 0
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );
  },
  set(value) {
    if (!value) {
      emit('update:modelValue', '');
      return;
    }
    
    let formattedDateTime = '';
    
    if (props.timeOnly) {
      // Только время: HH:mm:ss
      const hours = String(value.getHours()).padStart(2, '0');
      const minutes = String(value.getMinutes()).padStart(2, '0');
      const seconds = String(value.getSeconds()).padStart(2, '0');
      formattedDateTime = `${hours}:${minutes}:${seconds}`;
    } else if (props.showTime) {
      // Дата и время: YYYY-MM-DD HH:mm:ss
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      const hours = String(value.getHours()).padStart(2, '0');
      const minutes = String(value.getMinutes()).padStart(2, '0');
      const seconds = String(value.getSeconds()).padStart(2, '0');
      formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } else {
      // Только дата: YYYY-MM-DD
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      formattedDateTime = `${year}-${month}-${day}`;
    }
    
    emit('update:modelValue', formattedDateTime);
  }
});
</script>
