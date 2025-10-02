<template>
  <MultiSelect
    v-model="selectedItems"
    :options="items"
    optionLabel="content"
    optionValue="id"
    :placeholder="field.label || 'Выберите значения'"
    :disabled="disabled"
    :loading="loading"
    @change="onChange"
    display="chip"
    :filter="true"
    filterPlaceholder="Поиск..."
  />
</template>

<script setup>
import MultiSelect from 'primevue/multiselect';
import { ref, watchEffect, onMounted } from 'vue';
import { useNotifications } from './useNotifications.js';
import apiCtor from './api.js';

const model = defineModel({
  type: [String, Array],
  default: '',
});

const props = defineProps({
  field: {
    type: Object,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  data: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['set-value']);

const { notify } = useNotifications();

// API для основной таблицы (table)
const api = apiCtor(props.field.table);
// API для таблицы связей (table_link)
const apiLink = apiCtor(props.field.table_link);

const items = ref([]);
const selectedItems = ref([]);
const loading = ref(false);

// Загрузка всех доступных записей из table
const loadItems = async () => {
  loading.value = true;
  try {
    const response = await api.read({
      limit: 1000,
      setTotal: 0,
    });
    
    items.value = response.data.rows.map(row => ({
      id: row.id,
      content: row[props.field.title_field] || row.id,
    }));
  } catch (error) {
    notify('error', { detail: error.message });
  } finally {
    loading.value = false;
  }
};

// Загрузка выбранных записей из table_link
const loadSelectedItems = async () => {
  if (!props.data || !props.data.id) {
    selectedItems.value = [];
    return;
  }

  loading.value = true;
  try {
    const response = await apiLink.read({
      limit: 1000,
      setTotal: 0,
      filters: {
        [props.field.main_id]: {
          operator: 'and',
          constraints: [
            {
              value: props.data.id,
              matchMode: 'equals',
            },
          ],
        },
      },
    });

    selectedItems.value = response.data.rows.map(row => row[props.field.slave_id]);
  } catch (error) {
    notify('error', { detail: error.message });
  } finally {
    loading.value = false;
  }
};

// Обработка изменения выбора
const onChange = async () => {
  if (!props.data || !props.data.id) {
    notify('error', { detail: 'Невозможно сохранить связи: отсутствует ID основной записи' });
    return;
  }

  try {
    // Получаем текущие связи из базы
    const currentResponse = await apiLink.read({
      limit: 1000,
      setTotal: 0,
      filters: {
        [props.field.main_id]: {
          operator: 'and',
          constraints: [
            {
              value: props.data.id,
              matchMode: 'equals',
            },
          ],
        },
      },
    });

    const currentLinks = currentResponse.data.rows;
    const currentIds = currentLinks.map(row => row[props.field.slave_id]);

    // Определяем, какие связи нужно добавить
    const toAdd = selectedItems.value.filter(id => !currentIds.includes(id));

    // Определяем, какие связи нужно удалить
    const toDelete = currentLinks.filter(row => !selectedItems.value.includes(row[props.field.slave_id]));

    // Добавляем новые связи
    for (const slaveId of toAdd) {
      await apiLink.create({
        [props.field.main_id]: props.data.id,
        [props.field.slave_id]: slaveId,
      });
    }

    // Удаляем ненужные связи
    for (const link of toDelete) {
      await apiLink.delete({
        ids: link.id,
      });
    }

    emit('set-value', selectedItems.value.join(','));
  } catch (error) {
    notify('error', { detail: error.message });
  }
};

onMounted(async () => {
  await loadItems();
  await loadSelectedItems();
});

watchEffect(async () => {
  if (props.data && props.data.id) {
    await loadSelectedItems();
  }
});
</script>

<style scoped>
</style>
