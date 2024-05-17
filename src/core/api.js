import axios from "axios";
import { useNotifications } from "../composables/useNotifications";

console.log(import.meta.env)

export default (tableName) => {  
  const instance = axios.create({
    baseURL: `${import.meta.env.VITE_API_BASE_URL}/${tableName}`,
    timeout: 10000
  })

  const { notify } = useNotifications()

  instance.interceptors.request.use(
    (config) => config,
    (error) => {
      notify('error', { detail: error.message })
      Promise.reject(error)
    }
  )

  instance.interceptors.response.use(
    ({data}) => {
      if (!data.success) {
        throw new Error(response.message);
      }

      return data
    },
    ({message, response}) => {
      notify('error', { detail: message })
    }
  )

  return {

    create: async (data = null, params = {}) => {
      const response = await instance.put('/', data, { params })
      return response
    },

    read: async (params = {}) => {
      const response = await instance.get('/', { params })
      return response
    },

    update: async (params = {}) => {
      const query = {
        api_action: 'update',
        ...params
      } 
      const response = await instance.post('/', null, { params: query})
      return response
    },

    delete: async (params = {}) => {
      const response = await instance.delete('/', { params })
      return response
    },

    options: async (data = null, params = {}) => {
      const query = {
        api_action: 'options',
        ...params
      } 

      const response = await instance.post('/', data, { params: query})
      return response
    },

    autocomplete: async ( params = {}) => {
      const query = {
        api_action: 'autocomplete',
        ...params
      }
      const response = await instance.post('/', null, { params: query})
      return response
    },
  }
}
