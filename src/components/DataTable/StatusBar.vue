<template>
  <div class="datatable-status-bar">
    <div class="status-info">
      <span class="status-item">
        <i class="pi pi-check-square"></i>
        Выделено: <strong>{{ cellCount }}</strong> {{ cellWord }}
      </span>
      <span v-if="average !== null" class="status-item">
        <i class="pi pi-chart-line"></i>
        Среднее: <strong>{{ formatNumber(average) }}</strong>
      </span>
      <span v-if="sum !== null" class="status-item">
        <i class="pi pi-calculator"></i>
        Сумма: <strong>{{ formatNumber(sum) }}</strong>
      </span>
    </div>
    <Button 
      icon="pi pi-copy" 
      label="Копировать"
      size="small"
      severity="secondary"
      @click="copyToClipboard"
      :disabled="cellCount === 0"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Button from 'primevue/button';
import { useNotifications } from '../useNotifications';

const props = defineProps({
  selectedCells: {
    type: Array,
    required: true,
    default: () => []
  }
});

const emit = defineEmits(['copy']);

const { notify } = useNotifications();

// Количество выделенных ячеек
const cellCount = computed(() => props.selectedCells.length);

// Склонение слова "ячейка"
const cellWord = computed(() => {
  const count = cellCount.value;
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'ячеек';
  if (lastDigit === 1) return 'ячейка';
  if (lastDigit >= 2 && lastDigit <= 4) return 'ячейки';
  return 'ячеек';
});

// Сумма числовых значений (только для summable ячеек)
const sum = computed(() => {
  const numbers = props.selectedCells
    .filter(cell => cell.summable) // Фильтруем только суммируемые ячейки
    .map(cell => {
      const value = cell.value;
      // Обработка различных форматов чисел
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        // Удаляем пробелы и заменяем запятую на точку
        const cleaned = value.replace(/\s/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    })
    .filter(n => n !== null);
  
  return numbers.length > 0 
    ? numbers.reduce((acc, n) => acc + n, 0) 
    : null;
});

// Среднее значение (только для summable ячеек)
const average = computed(() => {
  if (sum.value === null) return null;
  
  const numbers = props.selectedCells
    .filter(cell => cell.summable) // Фильтруем только суммируемые ячейки
    .map(cell => {
      const value = cell.value;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const cleaned = value.replace(/\s/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    })
    .filter(n => n !== null);
  
  return numbers.length > 0 ? sum.value / numbers.length : null;
});

// Форматирование чисел
const formatNumber = (num) => {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
};

// Копирование в буфер обмена (TSV формат для Excel)
const copyToClipboard = async () => {
  if (props.selectedCells.length === 0) return;
  
  try {
    // Группировка ячеек по строкам
    const rowsMap = new Map();
    
    props.selectedCells.forEach(cell => {
      if (!rowsMap.has(cell.rowIndex)) {
        rowsMap.set(cell.rowIndex, []);
      }
      rowsMap.get(cell.rowIndex).push(cell);
    });
    
    // Сортировка строк и столбцов, форматирование в TSV
    const rows = Array.from(rowsMap.entries())
      .sort((a, b) => a[0] - b[0]) // Сортировка по индексу строки
      .map(([_, cells]) => {
        return cells
          .sort((a, b) => a.colIndex - b.colIndex) // Сортировка по индексу столбца
          .map(cell => {
            const value = cell.value ?? '';
            // Экранирование табуляций и переносов строк
            return String(value).replace(/\t/g, ' ').replace(/\n/g, ' ');
          })
          .join('\t'); // TSV = Tab-Separated Values
      });
    
    const tsvData = rows.join('\n');
    
    // Копирование в буфер обмена
    await navigator.clipboard.writeText(tsvData);
    
    notify('success', { 
      detail: `Скопировано ${cellCount.value} ${cellWord.value} в буфер обмена` 
    });
    
    emit('copy', tsvData);
  } catch (err) {
    console.error('Ошибка копирования:', err);
    notify('error', { 
      detail: 'Ошибка копирования: ' + err.message 
    });
  }
};
</script>

<style scoped>
.datatable-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  font-size: 14px;
  gap: 12px;
}

.status-info {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #495057;
}

.status-item i {
  color: #6c757d;
  font-size: 14px;
}

.status-item strong {
  color: #212529;
  font-weight: 600;
}

@media (max-width: 768px) {
  .datatable-status-bar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .status-info {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
