import { onMounted, reactive, ref } from "vue"

// type actionType = {
//   fieldName: string
//   data: any
//   isNew: boolean
// }

const maxValue = 3

export const useActionsCaching = () => {
  onMounted(() => {
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyZ' && event.ctrlKey) {
        undo()
      }
  
      if (event.code === 'KeyY' && event.ctrlKey) {
        redo()
      }
    })
  })

  const cache = reactive({
    undo: [],
    redo: [],
  })

  const lastAction = reactive({
    name: '',
    details: {}
  })

  const cacheAction = (data) => {
    if (cache.undo.length === maxValue) {
      cache.undo.shift()
    }

    cache.undo.push(data)
  }

  function undo() {
    if (cache.undo.length === 0) {
      return
    }

    lastAction.details = cache.undo.pop()
    lastAction.name = 'undo'

    if (lastAction.details.isNew) {
      // axios.delete()
    } else {
      // axios.patch()
    }

    cache.redo.push(lastAction.details)
  }

  function redo() {
    if (cache.redo.length === 0) {
      return
    }
    lastAction.details = cache.redo.pop()
    lastAction.name = 'redo'

    if (lastAction.details.isNew) {
      // axios.create()
    } else {
      // axios.patch()
    }

    cache.undo.push(lastAction.details)
  }

  return { undo, redo, cacheAction, cache }
}