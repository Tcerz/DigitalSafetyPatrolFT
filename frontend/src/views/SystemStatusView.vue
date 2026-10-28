<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-vue-next'
import { api } from '@/api'
import DataState from '@/components/DataState.vue'

// Fitur praktik CI/CD: menampilkan versi build (diisi pipeline) dan status setiap container/layanan.
const loading = ref(true), error = ref(''), services = ref([]), gateway = ref(null), checkedAt = ref('')
const frontend = {
  version: import.meta.env.VITE_APP_VERSION || 'dev',
  commit: import.meta.env.VITE_GIT_COMMIT || 'local',
  builtAt: import.meta.env.VITE_BUILD_TIME || 'unknown',
}
const LABEL = { auth: 'auth-service', master: 'master-data-service', report: 'report-service', notification: 'notification-service', audit: 'audit-service' }
let timer

async function load() {
  try {
    const [h, v] = await Promise.all([api.get('/health'), api.get('/version')])
    services.value = Object.entries(h.data.data.services).map(([k, status]) => ({ name: LABEL[k] || k, status }))
    gateway.value = v.data.data
    checkedAt.value = new Date().toLocaleTimeString('id-ID')
    error.value = ''
  } catch (e) { error.value = e.userMessage || 'Tidak dapat mengambil status sistem.' } finally { loading.value = false }
}
const down = () => services.value.filter((s) => s.status !== 'healthy').length
onMounted(() => { load(); timer = setInterval(load, 10000) }) // diperbarui otomatis tiap 10 detik
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="page-head">
    <h1>Status Sistem</h1>
    <div class="row"><small v-if="checkedAt">Diperiksa pukul {{ checkedAt }} (otomatis tiap 10 detik)</small><button class="btn" @click="load"><RefreshCw :size="15" /> Refresh</button></div>
  </div>
  <DataState :loading="loading" :error="error" loading-text="Memeriksa status layanan..." @retry="load">
    <div class="card" :style="{ borderLeft: '4px solid ' + (down() ? 'var(--bad)' : 'var(--ok)') }">
      <b>{{ down() ? `${down()} layanan bermasalah` : 'Semua layanan berjalan normal' }}</b>
    </div>
    <div class="grid2">
      <div class="card"><h2>Versi Frontend</h2>
        <dl class="dl"><dt>Versi</dt><dd>{{ frontend.version }}</dd><dt>Commit</dt><dd>{{ frontend.commit }}</dd><dt>Waktu build</dt><dd>{{ frontend.builtAt }}</dd></dl></div>
      <div class="card"><h2>Versi API Gateway</h2>
        <dl v-if="gateway" class="dl"><dt>Versi</dt><dd>{{ gateway.version }}</dd><dt>Commit</dt><dd>{{ gateway.commit }}</dd><dt>Waktu build</dt><dd>{{ gateway.builtAt || 'unknown' }}</dd></dl></div>
    </div>
    <div class="card flush">
      <div style="padding:16px 16px 0"><h2>Status Layanan (Container)</h2></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Layanan</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>api-gateway</td><td><span class="badge b-success"><CheckCircle2 :size="13" /> healthy</span></td></tr>
          <tr v-for="s in services" :key="s.name"><td>{{ s.name }}</td>
            <td><span class="badge" :class="s.status === 'healthy' ? 'b-success' : 'b-danger'"><component :is="s.status === 'healthy' ? CheckCircle2 : XCircle" :size="13" /> {{ s.status }}</span></td></tr>
        </tbody>
      </table></div>
    </div>
  </DataState>
</template>
