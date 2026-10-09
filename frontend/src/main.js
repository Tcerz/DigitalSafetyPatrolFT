import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import { useAuthStore } from './stores/auth'
import { useUiStore } from './stores/ui'

const app = createApp(App)
app.use(createPinia()).use(router)

const auth = useAuthStore()
const ui = useUiStore()
// Penanganan error API global (lihat src/api.js)
window.addEventListener('api-error', (e) => {
  const { status } = e.detail
  if (status === 401 && auth.isAuthenticated) {
    auth.clear()
    ui.toast('Sesi berakhir. Silakan login kembali.', 'error')
    router.push('/login')
  } else if (status === 403) ui.toast('Anda tidak memiliki akses.', 'error')
})
app.mount('#app')
