<template>
  <div class="pv-print-wrapper" style="display: inline-block;">
    <component 
      :is="'PVPrint'"
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
import { ref, onMounted, defineProps, defineEmits, inject } from 'vue'

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

// Получаем ComponentLoader через inject
const componentLoader = inject('componentLoader')

// Загрузка компонента PVPrint
const loadPVPrint = async () => {
  try {
    if (!componentLoader) {
      return
    }
    
    await componentLoader.loadComponent('PVPrint')
    isPVPrintLoaded.value = true
  } catch (error) {
    // Проверяем, является ли это ошибкой "компонент не найден"
    if (error.message && (error.message.includes('Component not found') || error.message.includes('Component not available'))) {
      console.warn('Компонент PVPrint недоступен')
    } else {
      console.error('Ошибка загрузки компонента PVPrint:', error)
      emit('print-error', error)
    }
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
  emit('print-success', result)
}

const handlePrintError = (error) => {
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
