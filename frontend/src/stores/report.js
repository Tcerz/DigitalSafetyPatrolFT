import { defineStore } from 'pinia'
import { reportService } from '@/services'
import { clean } from '@/lib/util'

const blankFilters = () => ({ search: '', depotId: '', tanggal: '', status: '', priority: '', condition: '', picId: '', activity: '', sortBy: 'createdAt', sortDir: 'desc' })

export const useReportStore = defineStore('report', {
  state: () => ({
    reports: [], currentReport: null, loading: false, error: '',
    filters: blankFilters(), pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  }),
  actions: {
    async fetchList() {
      this.loading = true; this.error = ''
      try {
        const res = await reportService.list({ ...clean(this.filters), page: this.pagination.page, limit: this.pagination.limit })
        this.reports = res.data || []
        if (res.pagination) this.pagination = { ...this.pagination, ...res.pagination }
      } catch (e) { this.error = e.userMessage || 'Tidak dapat mengambil data laporan.' }
      finally { this.loading = false }
    },
    async fetchOne(id) {
      this.loading = true; this.error = ''
      try { this.currentReport = (await reportService.get(id)).data }
      catch (e) { this.error = e.userMessage } finally { this.loading = false }
    },
    resetFilters() { this.filters = blankFilters(); this.pagination.page = 1 },
  },
})
