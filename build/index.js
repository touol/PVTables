import pvtables from './pvtables.vue'

export default {
    install: (app, options) => {
        app.component(pvtables.name, pvtables)
    }
}
export {
    pvtables as PVTables
}