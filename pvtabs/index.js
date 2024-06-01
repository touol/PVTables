import pvtabs from './PVTabs.vue'

export default {
    install: (app, options) => {
        app.component('PVTabs', pvtabs)
    }
}
export {
    pvtabs as PVTabs
}