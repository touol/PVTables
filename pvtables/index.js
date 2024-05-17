import pvtables from './PVTables.vue'

export default {
    install: (app, options) => {
        app.component(pvtables.name, pvtables)
    }
}
export {
    pvtables as PVTables
}