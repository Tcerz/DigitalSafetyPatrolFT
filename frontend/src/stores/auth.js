import { defineStore } from 'pinia'
import { authService } from '@/services'

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null, token: localStorage.getItem('dsp_token'), ready: false }),
  getters: { isAuthenticated: (s) => !!s.user, role: (s) => s.user?.role },
  actions: {
    async init() {
      if (this.token || document.cookie) {
        try { this.user = (await authService.me()).data } catch { this.clear() }
      }
      this.ready = true
    },
    async login(creds) {
      const res = await authService.login(creds)
      this.token = res.data.token || null
      if (this.token) localStorage.setItem('dsp_token', this.token)
      this.user = res.data.user || (await authService.me()).data
    },
    async logout() {
      try { await authService.logout() } catch { /* sesi lokal tetap dibersihkan */ }
      this.clear()
    },
    clear() { this.user = null; this.token = null; localStorage.removeItem('dsp_token') },
  },
})
