<template>
  <div class="pv-print-wrapper" style="display: inline-block;">
    <PVPrint 
      v-if="isPVPrintLoaded"
      :custom-print-handler="customPrintHandler"
      :page-key="pageKey"
      @print-success="handlePrintSuccess"
      @print-error="handlePrintError"
      ref="printBtn"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, defineProps, defineEmits } from 'vue'
import { ComponentLoader } from '../utils/component-loader'

const props = defineProps({
  table: {
    type: String,
    required: true
  },
  filters: {
    type: Object,
    default: () => ({})
  },
  api: {
    type: Object,
    required: true
  },
  pageKey: {
    type: String,
    default: 'pvtables-print'
  }
})

const emit = defineEmits(['print-success', 'print-error'])

const isPVPrintLoaded = ref(false)
const printBtn = ref(null)

// Загрузка компонента PVPrint
const loadPVPrint = async () => {
  try {
    const loader = new ComponentLoader(props.table)
    const component = await loader.loadComponent('PVPrint')
    
    if (component) {
      isPVPrintLoaded.value = true
      console.log('✓ Компонент PVPrint загружен через ComponentLoader')
    } else {
      throw new Error('PVPrint компонент не найден')
    }
  } catch (error) {
    console.error('Ошибка загрузки компонента PVPrint:', error)
    emit('print-error', error)
  }
}

// Кастомный обработчик печати
const customPrintHandler = async (printer, options) => {
  try {
    // Подготавливаем фильтры
    let filters0 = {}
    for (let field in props.filters) {
      if (props.filters[field].hasOwnProperty('constraints')) {
        if (props.filters[field].constraints[0].value !== null) {
          filters0[field] = props.filters[field]
        }
      } else {
        if (props.filters[field].value !== null) {
          filters0[field] = props.filters[field]
        }
      }
    }
    
    // Формируем параметры запроса
    const requestData = {
      filters: filters0,
      is_virtual: printer.is_virtual,
      printOptions: options
    }
    
    // Если не виртуальный принтер, добавляем printer_id
    if (printer.is_virtual !== 1) {
      requestData.printer_id = printer.id
    }
    
    // Отправляем запрос на печать
    const response = await props.api.action('print', requestData)
    
    if (!response.success) {
      throw new Error(response.message || 'Ошибка печати')
    }
    // Если виртуальный принтер, генерируем PDF
    if (printer.is_virtual == 1 && response.data.html) {
      // Получаем ссылку на компонент PVPrint через ref


      if (printBtn) {
        return await printBtn.value.generatePDF(response.data.html, {
          pageKey: props.pageKey,
          printOptions: options
        })
      }
      
      // Если не удалось получить метод generatePDF, возвращаем HTML
      return { success: true, html: response.data.html }
    }
    
    // Для физических принтеров возвращаем результат
    return response.data
  } catch (error) {
    console.error('Ошибка в customPrintHandler:', error)
    throw error
  }
}

const handlePrintSuccess = (result) => {
  console.log('Печать успешна:', result)
  emit('print-success', result)
}

const handlePrintError = (error) => {
  console.error('Ошибка печати:', error)
  emit('print-error', error)
}

onMounted(async () => {
  await loadPVPrint()
})
</script>

<style scoped>
.pv-print-wrapper {
  display: inline-block;
}
</style>
