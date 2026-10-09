import axios from 'axios'

// Satu-satunya tempat alamat backend dikonfigurasi (VITE_API_BASE_URL).
export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api', withCredentials: true })

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('dsp_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

api.interceptors.response.use(
  (r) => r,
  (e) => {
    const s = e.response?.status
    e.userMessage =
      s === 401 ? 'Sesi berakhir. Silakan login kembali.'
      : s === 403 ? 'Anda tidak memiliki akses.'
      : s === 404 ? 'Data tidak ditemukan.'
      : s >= 500 ? 'Terjadi kesalahan server. Coba lagi beberapa saat.'
      : e.response?.data?.message || 'Tidak dapat terhubung ke server.'
    window.dispatchEvent(new CustomEvent('api-error', { detail: { status: s } }))
    return Promise.reject(e)
  }
)
