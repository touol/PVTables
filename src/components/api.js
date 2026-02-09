import axios from "axios";
import { useNotifications } from "./useNotifications";

// console.log(import.meta.env)

export default (tableName, timeout = 60000) => {  
  let baseURL = '/'
  // console.log('import.meta.env',import.meta.env)
  // if(import.meta.env.VITE_API_BASE_URL){
  //   baseURL = import.meta.env.VITE_API_BASE_URL
  // }
  
  // Конфигурация для SSR поддержки
  const axiosConfig = {
    baseURL: `${baseURL}api/${tableName}`,
    timeout: timeout
  };

  const instance = axios.create(axiosConfig)

  const { notify } = useNotifications()

  instance.interceptors.request.use(
    (config) => {
      // console.log('DEV_TOKEN',import.meta.env.VITE_DEV_TOKEN)
      // if(import.meta.env.VITE_DEV_TOKEN) config.headers["Authorization"] = "Bearer " + import.meta.env.VITE_DEV_TOKEN;
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
      // Если success === 0 или false, выбрасываем ошибку
      if (data && data.success === 0) {
        throw new Error(data.message || 'Ошибка сервера');
      }
      
      // Если нет success поля и data.data пустой
      if (data && !data.success && data.data && Object.keys(data.data).length === 0) {
        throw new Error(data.message || 'Ошибка сервера');
      }

      return data
    },
    (error) => {
      const message = error.message || 'Произошла ошибка при запросе';
      console.log('notify2', message);
      notify('error', { detail: message });
      return Promise.reject(error);
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
      const response = await instance.patch('/', data, { params })
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
    nodedrop: async (params = {}) => {
      const query = {
        api_action: 'nodedrop',
        ...params
      }

      const response = await instance.post('/', null, { params: query})
      return response
    },
    action: async (action, params = {}) => {
      const query = {
        api_action: action,
        
      }

      const response = await instance.post('/', params, { params: query})
      return response
    },
  }
}
