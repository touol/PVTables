// import { useToast } from "primevue/usetoast";
import ToastEventBus from 'primevue/toasteventbus';

const messageTypes  = {
  success: {
    severity: 'success',
    summary: 'Успешно',
    life: 3000,
  },
  error: {
    severity: 'error',
    summary: 'Ошибка',
    life: 3000
  }
}

const logTypes = {
  success: 'info',
  error: 'error',
  warning: 'warn'
}

export const useNotifications = () => {
  // const toast = useToast()

  const notify = (type = '', message, shouldLog = false) => {
    const messageObj = {
      ...messageTypes[type],
      ...message
    }

    // toast.add(messageObj)
    // console.log('notify')
    ToastEventBus.emit('add', messageObj);

    if (shouldLog) {
      const logMethod = logTypes[type]
      console[logMethod](messageObj)
    }
  }

  return { notify }
}