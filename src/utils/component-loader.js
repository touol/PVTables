export class ComponentLoader {
  constructor(table = 'tSkladNaryad') {
    this.loadedComponents = new Set()
    this.loadingComponents = new Map()
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
      
      if (data.assets_path) {
        this.assetsPath = data.assets_path
        console.log('✓ Assets path получен:', this.assetsPath)
      } else {
        throw new Error('Не удалось получить assets path')
      }
    } catch (error) {
      console.warn('Используем fallback assets path:', error.message)
      // Fallback на default путь
      this.assetsPath = '/assets/components/'
    }
  }

  /**
   * Загружает компонент по имени
   * @param {string} componentName - Название компонента
   * @returns {Promise<Object>} - Возвращает загруженный компонент
   */
  async loadComponent(componentName) {
    await this.initialize()
    
    if (this.loadedComponents.has(componentName)) {
      // Возвращаем из window если уже загружен
      return window[componentName] || null
    }

    if (this.loadingComponents.has(componentName)) {
      return this.loadingComponents.get(componentName)
    }

    const loadPromise = this._doLoadComponent(componentName)
    this.loadingComponents.set(componentName, loadPromise)

    try {
      const component = await loadPromise
      this.loadedComponents.add(componentName)
      return component
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
    
    try {
      // 1. Загружаем CSS
      await this._loadCSS(`${basePath}/css/${componentName.toLowerCase()}.css`)
      
      // 2. Загружаем JS модуль
      const module = await this._loadJS(`${basePath}/js/${componentName.toLowerCase()}.js`)
      
      // Проверяем, может быть это UMD и нужно взять из window
      let componentModule = module
      if (window[componentName]) {
        componentModule = window[componentName]
      }
      
      // Возвращаем компонент
      if (componentModule.default) {
        return componentModule.default
      } else if (componentModule[componentName]) {
        return componentModule[componentName]
      } else {
        return componentModule
      }
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
      link.onerror = () => reject(new Error(`Failed to load CSS: ${url}`))
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
