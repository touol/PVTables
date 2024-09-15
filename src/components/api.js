import axios from "axios";
import { useNotifications } from "./useNotifications";

// console.log(import.meta.env)

export default (tableName, timeout = 10000) => {  
  let baseURL = '/'
  if(import.meta.env.VITE_API_BASE_URL){
    baseURL = import.meta.env.VITE_API_BASE_URL
  }
  const instance = axios.create({
    baseURL: `${baseURL}api/${tableName}`,
    timeout: timeout
  })

  const { notify } = useNotifications()

  instance.interceptors.request.use(
    (config) => {
      // console.log('DEV_TOKEN',import.meta.env.VITE_DEV_TOKEN)
      if(import.meta.env.VITE_DEV_TOKEN) config.headers["Authorization"] = "Bearer " + import.meta.env.VITE_DEV_TOKEN;
      return config;
    },
    (error) => {
      // console.log('notify1')
      notify('error', { detail: error.message })
      Promise.reject(error)
    }
  )

  instance.interceptors.response.use(
    ({data}) => {
      if (!data.success && Object.keys(data.data).length === 0) {
        throw new Error(data.message);
      }

      return data
    },
    ({message, response}) => {
      console.log('notify2')
      notify('error', { detail: message })
    }
  )

  return {

    create: async (data = null, params = {}) => {
      const response = await instance.put('/', data, { params })
      return response
    },

    get: async (id) => {
      let params = {
        limit: 1,
        setTotal: 0,
        filters: {id:{value:id,matchMode:"equals"}},
      };
      const response = await instance.get('/', { params })
      // console.log('response',response)
      if(response.data.rows.length == 1)
        return response.data.rows[0]
      throw new Error(response.message);
    },

    read: async (params = {}) => {
      const response = await instance.get('/', { params })
      return response
    },

    update: async (data = null, params = {}) => {
      const response = await instance.patch('/', data, params)
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

    autocomplete: async (params = {}) => {
      const query = {
        api_action: 'autocomplete',
        ...params
      }

      const response = await instance.post('/', null, { params: query})
      return response
    },
    action: async (action, params = {}) => {
      const query = {
        api_action: action,
        ...params
      }

      const response = await instance.post('/', null, { params: query})
      return response
    },
  }
}
