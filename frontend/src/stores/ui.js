import { defineStore } from 'pinia'
let n = 0
export const useUiStore = defineStore('ui', {
  state: () => ({ toasts: [] }),
  actions: {
    toast(message, type = 'success') {
      const id = ++n
      this.toasts.push({ id, message, type })
      setTimeout(() => this.remove(id), 4000)
    },
    remove(id) { this.toasts = this.toasts.filter((t) => t.id !== id) },
  },
})
