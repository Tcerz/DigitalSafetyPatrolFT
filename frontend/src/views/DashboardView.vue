<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { RefreshCw, Plus } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { statisticsService, reportService, depotService } from '@/services'
import { clean, fmtDate, STATUSES, PRIORITIES, label, isOverdue } from '@/lib/util'
import DataState from '@/components/DataState.vue'
import BarList from '@/components/BarList.vue'
import ConditionDonut from '@/components/ConditionDonut.vue'
import Badge from '@/components/Badge.vue'

const auth = useAuthStore()
const loading = ref(true), error = ref(''), s = ref({}), recent = ref([]), activity = ref([]), trend = ref([]), depots = ref([])
const filters = reactive({ depotId: '', from: '', to: '', status: '', priority: '' })
const KPI = {
  PETUGAS: [['totalPatrol', 'Total Laporan Saya'], ['draft', 'Draft', 'neutral'], ['submitted', 'Submitted', 'info'], ['inProgress', 'In Progress', 'warn'], ['resolved', 'Resolved', 'ok']],
  ADMIN: [['totalPatrol', 'Total Patrol'], ['unsafe', 'Unsafe Finding', 'danger'], ['needVerification', 'Need Verification', 'info'], ['inProgress', 'In Progress', 'warn'], ['resolved', 'Resolved', 'ok'], ['overdue', 'Overdue', 'danger']],
  SUPERADMIN: [['totalDepot', 'Total Depot'], ['totalUser', 'Total User'], ['totalPatrol', 'Total Patrol'], ['unsafe', 'Unsafe Finding', 'danger'], ['openFinding', 'Open Finding', 'danger'], ['inProgress', 'In Progress', 'warn'], ['resolved', 'Resolved', 'ok'], ['overdue', 'Overdue', 'danger']],
}
const kpis = computed(() => KPI[auth.role] || [])
async function load() {
  loading.value = true; error.value = ''
  try {
    const p = clean(filters)
    const [a, b, c, d] = await Promise.all([
      statisticsService.summary(p),
      reportService.list({ ...p, limit: 5, sortBy: 'createdAt', sortDir: 'desc' }),
      statisticsService.activity(p),
      statisticsService.trend({ ...p, range: '7d' }),
    ])
    s.value = a.data || {}; recent.value = b.data || []
    activity.value = (c.data || []).map((x) => ({ label: label(x.activity), value: x.count }))
    trend.value = (d.data || []).map((x) => ({ label: x.label, value: x.count }))
  } catch (e) { error.value = e.userMessage || 'Tidak dapat mengambil data dashboard.' } finally { loading.value = false }
}
onMounted(async () => {
  if (auth.role === 'SUPERADMIN') { try { depots.value = (await depotService.list({ limit: 200 })).data } catch { /* filter depot opsional */ } }
  load()
})
</script>
<template>
  <div class="page-head">
    <h1>Dashboard</h1>
    <div class="row">
      <button class="btn" @click="load"><RefreshCw :size="15" /> Refresh</button>
      <RouterLink v-if="auth.role === 'PETUGAS'" class="btn primary" to="/reports/create"><Plus :size="15" /> Buat Safety Patrol</RouterLink>
      <RouterLink class="btn" to="/reports">Lihat Laporan</RouterLink>
      <RouterLink v-if="auth.role !== 'PETUGAS'" class="btn" to="/corrective-actions">Lihat Finding</RouterLink>
    </div>
  </div>
  <div v-if="auth.role === 'SUPERADMIN'" class="card filters">
    <label class="f"><span>Depot</span><select v-model="filters.depotId" @change="load"><option value="">Semua</option><option v-for="d in depots" :key="d.id" :value="d.id">{{ d.name }}</option></select></label>
    <label class="f"><span>Dari</span><input type="date" v-model="filters.from" @change="load" /></label>
    <label class="f"><span>Sampai</span><input type="date" v-model="filters.to" @change="load" /></label>
    <label class="f"><span>Status</span><select v-model="filters.status" @change="load"><option value="">Semua</option><option v-for="x in STATUSES" :key="x" :value="x">{{ label(x) }}</option></select></label>
    <label class="f"><span>Priority</span><select v-model="filters.priority" @change="load"><option value="">Semua</option><option v-for="x in PRIORITIES" :key="x">{{ x }}</option></select></label>
  </div>
  <DataState :loading="loading" :error="error" loading-text="Loading dashboard..." @retry="load">
    <div class="kpis"><div v-for="k in kpis" :key="k[0]" class="kpi" :class="k[2]"><small>{{ k[1] }}</small><b>{{ s[k[0]] ?? 0 }}</b></div></div>
    <div v-if="auth.role !== 'PETUGAS' && s.overdue" class="card" style="border-left:4px solid var(--bad)"><b class="overdue">⚠ Overdue Actions: {{ s.overdue }}</b> — <RouterLink to="/corrective-actions">tinjau tindak lanjut</RouterLink></div>
    <div class="grid2">
      <div class="card"><h2>Aktivitas Patrol</h2><BarList :items="activity" /></div>
      <div class="card"><h2>Kondisi Keselamatan</h2><ConditionDonut :safe="s.safe || 0" :unsafe="s.unsafe || 0" /></div>
    </div>
    <div class="card"><h2>Tren Laporan 7 Hari</h2><BarList :items="trend" vertical /></div>
    <div class="card flush">
      <div style="padding:16px 16px 0"><h2>Laporan Terbaru</h2></div>
      <DataState :empty="!recent.length"><template #empty>Belum ada laporan Safety Patrol.<br><RouterLink v-if="auth.role === 'PETUGAS'" class="btn primary" to="/reports/create">+ Buat Laporan</RouterLink></template>
        <div class="table-wrap"><table><thead><tr><th>Report Number</th><th>Tanggal</th><th>Depot</th><th>Kondisi</th><th>Status</th></tr></thead><tbody>
          <tr v-for="r in recent" :key="r.id"><td><RouterLink :to="`/reports/${r.id}`">{{ r.reportNumber || '(Draft)' }}</RouterLink></td><td>{{ fmtDate(r.tanggal) }}</td><td>{{ r.depotName }}</td><td><Badge :value="r.kondisi" kind="condition" /></td><td><Badge :value="r.status" /></td></tr>
        </tbody></table></div>
      </DataState>
    </div>
  </DataState>
</template>
