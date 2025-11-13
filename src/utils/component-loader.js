import apiCtor from '../components/api.js'

export class ComponentLoader {
  constructor(app) {
    this.app = app
    this.loadedComponents = new Map() // Изменено на Map для хранения модулей
    this.loadingComponents = new Map()
    this.assetsPath = null
    
    // Используем API клиент для tSkladNaryad
    this.api = apiCtor('tSkladNaryad')
  }

  /**
   * Инициализация - получаем assets path с сервера
   */
  async initialize() {
    if (this.assetsPath) return
    
    try {
      // Пытаемся получить assets path с сервера
      const response = await fetch('/api/get_assets_path')
      const data = await response.json()
      
      if (data.data.assets_path) {
        this.assetsPath = data.data.assets_path
      } else {
        throw new Error('Не удалось получить assets path')
      }
    } catch (error) {
      // Fallback на default путь
      this.assetsPath = '/assets/components/'
    }
  }

  /**
   * Загружает компонент по имени
   * @param {string} componentName - Название компонента
   * @returns {Promise<void>}
   */
  async loadComponent(componentName) {
    await this.initialize()
    
    // Проверяем, не загружен ли уже компонент
    if (this.loadedComponents.has(componentName)) {
      return
    }

    // Проверяем, не загружается ли компонент в данный момент
    if (this.loadingComponents.has(componentName)) {
      return this.loadingComponents.get(componentName)
    }

    const loadPromise = this._doLoadComponent(componentName)
    this.loadingComponents.set(componentName, loadPromise)

    try {
      await loadPromise
      // Модуль уже сохранен в _doLoadComponent через .set()
    } finally {
      this.loadingComponents.delete(componentName)
    }
  }

  /**
   * Внутренний метод загрузки компонента
   * @private
   */
  async _doLoadComponent(componentName) {
    const basePath = `${this.assetsPath}${componentName.toLowerCase()}/web`
    
    // Дополнительная проверка на случай race condition
    if (this.loadedComponents.has(componentName)) {
      return
    }
    
    try {
      // 1. Предоставляем зависимости глобально для UMD модулей
      if (!window.PVTablesAPI) {
        // Импортируем необходимые зависимости
        const { useNotifications } = await import('../components/useNotifications.js')
        const apiCtor = (await import('../components/api.js')).default
        const Vue = await import('vue')
        
        window.PVTablesAPI = {
          useNotifications,
          apiCtor,
          Vue
        }
        
        // Также делаем Vue доступным глобально для UMD модулей
        if (!window.Vue) {
          window.Vue = Vue
        }
      }
      
      // 2. Загружаем CSS
      await this._loadCSS(`${basePath}/css/${componentName.toLowerCase()}.css`)
      
      // 3. Загружаем JS модуль
      const module = await this._loadJS(`${basePath}/js/${componentName.toLowerCase()}.js`)
      
      // Проверяем, может быть это UMD и нужно взять из window
      let componentModule = module
      if (window[componentName]) {
        componentModule = window[componentName]
      }
      
      // 4. Регистрируем компонент глобально
      if (componentModule.default && typeof componentModule.default.install === 'function') {
        // Если это плагин с методом install
        this.app.use(componentModule.default)
      } else if (componentModule.default) {
        // Если это просто компонент
        this.app.component(componentName, componentModule.default)
      } else if (componentModule[componentName]) {
        // Если экспортирован по имени
        this.app.component(componentName, componentModule[componentName])
      }
      
      // 5. Сохраняем модуль в Map для доступа к экспортированным функциям
      this.loadedComponents.set(componentName, componentModule)
      
      console.log(`✓ Компонент ${componentName} загружен и зарегистрирован`)
    } catch (error) {
      console.error(`✗ Ошибка загрузки компонента ${componentName}:`, error)
      throw error
    }
  }

  /**
   * Загружает CSS файл
   * @private
   */
  _loadCSS(url) {
    return new Promise((resolve, reject) => {
      // Проверяем, не загружен ли уже
      if (document.querySelector(`link[href="${url}"]`)) {
        resolve()
        return
      }

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url
      link.onload = () => resolve()
      link.onerror = () => {
        // Проверяем, действительно ли файл не найден (404)
        fetch(url, { method: 'HEAD' })
          .then(response => {
            if (response.status === 404) {
              console.warn(`CSS файл не найден: ${url}`)
              resolve() // Не блокируем загрузку, если CSS не найден
            } else {
              reject(new Error(`Failed to load CSS: ${url}`))
            }
          })
          .catch(() => {
            console.warn(`CSS файл недоступен: ${url}`)
            resolve() // Не блокируем загрузку
          })
      }
      document.head.appendChild(link)
    })
  }

  /**
   * Загружает JS модуль
   * @private
   */
  _loadJS(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.type = 'module'
      script.src = url
      
      script.onload = async () => {
        try {
          const module = await import(/* @vite-ignore */ url)
          resolve(module)
        } catch (error) {
          reject(error)
        }
      }
      
      script.onerror = () => {
        // Проверяем, действительно ли файл не найден (404)
        fetch(url, { method: 'HEAD' })
          .then(response => {
            if (response.status === 404) {
              reject(new Error(`Component not found: ${url}`))
            } else {
              reject(new Error(`Failed to load JS: ${url}`))
            }
          })
          .catch(() => {
            reject(new Error(`Component not available: ${url}`))
          })
      }
      document.head.appendChild(script)
    })
  }

  /**
   * Получает список компонентов из таблицы tSkladNaryad
   * @returns {Promise<string[]>}
   */
  async fetchComponentsList() {
    try {
      const response = await this.api.read()
      
      if (!response.success) {
        console.error('Ошибка чтения tSkladNaryad:', response.message)
        return []
      }
      
      // Извлекаем названия компонентов из поля component
      const components = response.data.rows
        .map(row => row.component)
        .filter(component => component && component.trim() !== '')
      
      // Убираем дубликаты
      return [...new Set(components)]
    } catch (error) {
      console.error('Ошибка получения списка компонентов:', error)
      return []
    }
  }

  /**
   * Загружает все компоненты из списка
   * @param {string[]} components - Массив названий компонентов
   * @returns {Promise<void>}
   */
  async loadComponents(components) {
    const promises = components.map(name => this.loadComponent(name))
    await Promise.allSettled(promises)
  }
}
