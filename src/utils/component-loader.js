export class ComponentLoader {
  constructor(app) {
    this.app = app
    this.loadedComponents = new Map() // Изменено на Map для хранения модулей
    this.loadingComponents = new Map()
    this.failedComponents = new Set() // Компоненты, которые не удалось загрузить
    this.assetsPath = null
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

    // Не пытаемся повторно загрузить компонент, который уже не удалось загрузить
    if (this.failedComponents.has(componentName)) {
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
    } catch (error) {
      this.failedComponents.add(componentName)
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
    const cacheBuster = `?v=${Date.now()}`

    // Дополнительная проверка на случай race condition
    if (this.loadedComponents.has(componentName)) {
      return
    }

    try {
      // 0. Проверяем существование JS-файла одним HEAD запросом
      const jsUrl = `${basePath}/js/${componentName.toLowerCase()}.js`
      const headResponse = await fetch(jsUrl + cacheBuster, { method: 'HEAD' })
      if (!headResponse.ok) {
        throw new Error(`Component not found: ${jsUrl}`)
      }

      // 1. Предоставляем зависимости глобально для UMD модулей
      // Дополняем PVTablesAPI, если он уже существует, или создаем новый
      if (!window.PVTablesAPI) {
        const { useNotifications } = await import('../components/useNotifications.js')
        const apiCtor = (await import('../components/api.js')).default
        const Vue = await import('vue')
        
        window.PVTablesAPI = {
          useNotifications,
          apiCtor,
          Vue
        }
      } else {
        // Если PVTablesAPI уже существует, добавляем Vue если его нет
        if (!window.PVTablesAPI.Vue) {
          const Vue = await import('vue')
          window.PVTablesAPI.Vue = Vue
        }
      }
      
      // Также делаем Vue доступным глобально для UMD модулей
      if (!window.Vue) {
        const Vue = window.PVTablesAPI.Vue || await import('vue')
        window.Vue = Vue
      }
      
      // 2. Загружаем CSS
      await this._loadCSS(`${basePath}/css/${componentName.toLowerCase()}.css${cacheBuster}`)

      // 3. Загружаем JS модуль
      const module = await this._loadJS(`${basePath}/js/${componentName.toLowerCase()}.js${cacheBuster}`)
      
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
      throw error
    }
  }

  /**
   * Загружает CSS файл
   * @private
   */
  _loadCSS(url) {
    return new Promise((resolve, reject) => {
      // Проверяем, не загружен ли уже (без учёта query-параметров)
      const urlBase = url.split('?')[0]
      const existing = document.querySelector(`link[href^="${urlBase}"]`)
      if (existing) {
        existing.href = url
        resolve()
        return
      }

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url
      link.onload = () => resolve()
      link.onerror = () => resolve() // CSS необязателен, не блокируем
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
      
      script.onerror = () => reject(new Error(`Failed to load JS: ${url}`))
      document.head.appendChild(script)
    })
  }

}
