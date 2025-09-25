import { ofetch } from 'ofetch';
import { useNotifications } from "./useNotifications";

export default (tableName, timeout = 60000) => {
  let baseURL = '/';
  
  // Конфигурация для SSR поддержки
  if (typeof window === 'undefined') {
    if (typeof globalThis.SSR_BASE_URL !== 'undefined') {
      baseURL = globalThis.SSR_BASE_URL;
    } else {
      baseURL = 'http://localhost/';
    }
  }

  const apiBaseURL = `${baseURL}api/${tableName}`;
  const { notify } = useNotifications();

  // Создаем экземпляр ofetch с базовой конфигурацией
  const $fetch = ofetch.create({
    baseURL: apiBaseURL,
    timeout,
    retry: 1,
    onRequestError({ error }) {
      notify('error', { detail: error.message });
    },
    onResponseError({ response }) {
      notify('error', { detail: `HTTP ${response.status}: ${response.statusText}` });
    }
  });

  // Обертка для дополнительной обработки ответов
  async function apiRequest(url, options = {}) {
    try {
      let response = await $fetch(url, options);
      
      // В браузере ofetch может возвращать строку, парсим её
      if (typeof response === 'string') {
        try {
          response = JSON.parse(response);
        } catch (parseError) {
          console.warn('Не удалось распарсить JSON:', parseError);
        }
      }
      
      // Проверяем структуру ответа только если это наш API формат
      if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
        if (!response.success && Object.keys(response.data || {}).length === 0) {
          throw new Error(response.message || 'API Error');
        }
      }
      
      return response;
    } catch (error) {
      // Дополнительная обработка ошибок
      if (error.message && !error.message.includes('HTTP')) {
        notify('error', { detail: error.message });
      }
      throw error;
    }
  }

  return {
    create: async (data = null, params = {}) => {
      return await apiRequest('/', {
        method: 'PUT',
        body: data,
        params
      });
    },

    get: async (id) => {
      const params = {
        limit: 1,
        setTotal: 0,
        filters: { id: { value: id, matchMode: "equals" } },
      };
      const response = await apiRequest('/', { params });
      
      if (response.data.rows.length === 1) {
        return response.data.rows[0];
      }
      throw new Error(response.message);
    },

    read: async (params = {}) => {
      return await apiRequest('/', { params });
    },

    update: async (data = null, params = {}) => {
      return await apiRequest('/', {
        method: 'PATCH',
        body: data,
        params
      });
    },

    delete: async (params = {}) => {
      return await apiRequest('/', {
        method: 'DELETE',
        params
      });
    },

    options: async (data = null, params = {}) => {
      const query = {
        api_action: 'options',
        ...params
      };
      return await apiRequest('/', {
        method: 'POST',
        body: data,
        params: query
      });
    },

    autocomplete: async (params = {}) => {
      const query = {
        api_action: 'autocomplete',
        ...params
      };
      return await apiRequest('/', {
        method: 'POST',
        params: query
      });
    },

    nodedrop: async (params = {}) => {
      const query = {
        api_action: 'nodedrop',
        ...params
      };
      return await apiRequest('/', {
        method: 'POST',
        params: query
      });
    },

    action: async (action, params = {}) => {
      const query = {
        api_action: action,
      };
      return await apiRequest('/', {
        method: 'POST',
        body: params,
        params: query
      });
    },
  };
};
