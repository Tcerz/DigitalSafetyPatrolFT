<script setup>
import { ref, reactive, onMounted } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { statisticsService, depotService } from '@/services'
import { clean, ACTIVITIES, STATUSES, PRIORITIES, label } from '@/lib/util'
import DataState from '@/components/DataState.vue'
import BarList from '@/components/BarList.vue'
import ConditionDonut from '@/components/ConditionDonut.vue'

const auth = useAuthStore()
const loading = ref(true), error = ref(''), s = ref({}), depots = ref([])
const d = reactive({ activity: [], trend: [], tanks: [], personnel: [], products: [] })
const f = reactive({ depotId: '', from: '', to: '', activity: '', status: '', priority: '', range: '30d' })
const RANGES = [['7d', '7 Days'], ['30d', '30 Days'], ['6m', '6 Months'], ['custom', 'Custom']]
const map = (a, k = 'name') => (a || []).map((x) => ({ label: label(x[k] ?? x.label ?? x.tank), value: x.count }))
async function load() {
  loading.value = true; error.value = ''
  const p = clean(f)
  try {
    const [a, b, c, t, pe, pr] = await Promise.all(['summary', 'activity', 'trend', 'tanks', 'personnel', 'products'].map((k) => statisticsService[k](p)))
    s.value = a.data || {}
    d.activity = map(b.data, 'activity'); d.trend = map(c.data, 'label'); d.tanks = map(t.data, 'tank'); d.personnel = map(pe.data); d.products = map(pr.data)
  } catch (e) { error.value = e.userMessage || 'Tidak dapat mengambil data statistik.' } finally { loading.value = false }
}
onMounted(async () => {
  if (auth.role === 'SUPERADMIN') { try { depots.value = (await depotService.list({ limit: 200 })).data } catch { /* opsional */ } }
  load()
})
</script>
<template>
  <div class="page-head"><h1>Statistics</h1><button class="btn" @click="load"><RefreshCw :size="15" /> Refresh</button></div>
  <div class="card filters">
    <label v-if="auth.role === 'SUPERADMIN'" class="f"><span>Depot</span><select v-model="f.depotId" @change="load"><option value="">Semua</option><option v-for="x in depots" :key="x.id" :value="x.id">{{ x.name }}</option></select></label>
    <label class="f"><span>Rentang</span><select v-model="f.range" @change="load"><option v-for="r in RANGES" :key="r[0]" :value="r[0]">{{ r[1] }}</option></select></label>
    <template v-if="f.range === 'custom'"><label class="f"><span>Dari</span><input type="date" v-model="f.from" @change="load" /></label><label class="f"><span>Sampai</span><input type="date" v-model="f.to" @change="load" /></label></template>
    <label class="f"><span>Aktivitas</span><select v-model="f.activity" @change="load"><option value="">Semua</option><option v-for="x in ACTIVITIES" :key="x" :value="x">{{ label(x) }}</option></select></label>
    <label class="f"><span>Status</span><select v-model="f.status" @change="load"><option value="">Semua</option><option v-for="x in STATUSES" :key="x" :value="x">{{ label(x) }}</option></select></label>
    <label class="f"><span>Priority</span><select v-model="f.priority" @change="load"><option value="">Semua</option><option v-for="x in PRIORITIES" :key="x">{{ x }}</option></select></label>
  </div>
  <DataState :loading="loading" :error="error" loading-text="Loading statistics..." @retry="load">
    <div class="kpis">
      <div class="kpi"><small>Total Patrol</small><b>{{ s.totalPatrol ?? 0 }}</b></div><div class="kpi ok"><small>Safe</small><b>{{ s.safe ?? 0 }}</b></div>
      <div class="kpi danger"><small>Unsafe</small><b>{{ s.unsafe ?? 0 }}</b></div><div class="kpi danger"><small>Open Finding</small><b>{{ s.openFinding ?? 0 }}</b></div>
      <div class="kpi ok"><small>Resolved</small><b>{{ s.resolved ?? 0 }}</b></div><div class="kpi danger"><small>Overdue</small><b>{{ s.overdue ?? 0 }}</b></div>
    </div>
    <div class="grid2">
      <div class="card"><h2>Activity Distribution</h2><BarList :items="d.activity" /></div>
      <div class="card"><h2>Safety Condition</h2><ConditionDonut :safe="s.safe || 0" :unsafe="s.unsafe || 0" /></div>
    </div>
    <div class="card"><h2>Trend Laporan</h2><BarList :items="d.trend" vertical /></div>
    <div class="grid2">
      <div class="card"><h2>Tangki Teratas</h2><BarList :items="d.tanks" /></div>
      <div class="card"><h2>Personel Teraktif</h2><BarList :items="d.personnel" /></div>
      <div class="card"><h2>Produk Teratas</h2><BarList :items="d.products" /></div>
    </div>
    <div v-if="auth.role === 'SUPERADMIN'" class="card flush"><div style="padding:16px 16px 0"><h2>Depot Comparison</h2></div>
      <DataState :empty="!s.depots?.length" empty-text="Belum ada data depot."><div class="table-wrap"><table><thead><tr><th>Depot</th><th>Total Patrol</th><th>Unsafe Finding</th><th>Resolved</th><th>Overdue</th></tr></thead>
        <tbody><tr v-for="x in s.depots" :key="x.name"><td>{{ x.name }}</td><td>{{ x.totalPatrol }}</td><td>{{ x.unsafe }}</td><td>{{ x.resolved }}</td><td :class="{ overdue: x.overdue }">{{ x.overdue }}</td></tr></tbody></table></div></DataState></div>
  </DataState>
</template>
