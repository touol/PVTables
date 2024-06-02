import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import PrimeVue from 'primevue/config';

import ToastService from 'primevue/toastservice';

import 'primevue/resources/themes/aura-light-green/theme.css'
import 'primeicons/primeicons.css'

const app = createApp(App)

app.use(PrimeVue, { ripple: true })
app.use(ToastService);
app.mount('#app')
