<template>
  <div>
    <Calendar v-model="computedDate" showIcon :showOnFocus="false" :disabled="disabled"/>
  </div>
</template>

<script setup>
import Calendar from "primevue/calendar";
import { computed } from "vue";

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false,
  }
})

const emit = defineEmits(['update:modelValue'])

const computedDate = computed({
  get() {
    return props.modelValue.split('-').reverse().join('.')
  },
  set(value) {
    const formattedDate = value.toLocaleDateString('ru-RU').split('.').reverse().join('-')
    emit('update:modelValue', formattedDate)
  }
});
</script>

