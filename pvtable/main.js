import { createApp } from 'vue'
// import './style.css'
import App from './PVTable.vue'
import PrimeVue from 'primevue/config';
// import 'primevue/resources/themes/aura-light-green/theme.css'
// import 'primeicons/primeicons.css'
import ToastService from 'primevue/toastservice';

const app = createApp(App)

app.use(PrimeVue, { ripple: true })
app.use(ToastService);
app.mount('#pvtable')
