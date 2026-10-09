<script setup>
import { ref, watch, onMounted } from 'vue'
import { Plus, RefreshCw, Eye, Pencil, Trash2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useReportStore } from '@/stores/report'
import { useUiStore } from '@/stores/ui'
import { depotService, personnelService, reportService } from '@/services'
import { fmtDate, STATUSES, PRIORITIES, ACTIVITIES, label } from '@/lib/util'
import DataState from '@/components/DataState.vue'
import Pagination from '@/components/Pagination.vue'
import Badge from '@/components/Badge.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'

const auth = useAuthStore(), st = useReportStore(), ui = useUiStore()
const depots = ref([]), people = ref([]), del = ref(null), busy = ref(false)
const apply = () => { st.pagination.page = 1; st.fetchList() }
let t
watch(() => st.filters.search, () => { clearTimeout(t); t = setTimeout(apply, 400) })
const mine = (r) => r.status === 'DRAFT' && auth.role === 'PETUGAS'
const canEdit = (r) => mine(r) || auth.role === 'SUPERADMIN'
const canDel = (r) => mine(r) || (auth.role === 'SUPERADMIN' && r.status !== 'CLOSED')
async function remove() {
  busy.value = true
  try { await reportService.remove(del.value.id); ui.toast('Laporan berhasil dihapus.'); del.value = null; st.fetchList() }
  catch (e) { ui.toast(e.userMessage || 'Gagal menghapus laporan.', 'error') } finally { busy.value = false }
}
onMounted(async () => {
  st.fetchList()
  try {
    if (auth.role === 'SUPERADMIN') depots.value = (await depotService.list({ limit: 200 })).data
    people.value = (await personnelService.list({ limit: 200 })).data
  } catch { /* filter opsional */ }
})
</script>
<template>
  <div class="page-head">
    <h1>{{ auth.role === 'PETUGAS' ? 'Laporan Saya' : 'Laporan Safety Patrol' }}</h1>
    <div class="row">
      <button class="btn" @click="st.fetchList()"><RefreshCw :size="15" /> Refresh</button>
      <RouterLink v-if="auth.role === 'PETUGAS'" class="btn primary" to="/reports/create"><Plus :size="15" /> Buat Laporan</RouterLink>
    </div>
  </div>
  <div class="card filters">
    <label class="f"><span>Cari</span><input v-model="st.filters.search" placeholder="No. laporan / PIC / pembuat" /></label>
    <label v-if="auth.role === 'SUPERADMIN'" class="f"><span>Depot</span><select v-model="st.filters.depotId" @change="apply"><option value="">Semua</option><option v-for="d in depots" :key="d.id" :value="d.id">{{ d.name }}</option></select></label>
    <label class="f"><span>Tanggal</span><input type="date" v-model="st.filters.tanggal" @change="apply" /></label>
    <label class="f"><span>Status</span><select v-model="st.filters.status" @change="apply"><option value="">Semua</option><option v-for="x in STATUSES" :key="x" :value="x">{{ label(x) }}</option></select></label>
    <label class="f"><span>Priority</span><select v-model="st.filters.priority" @change="apply"><option value="">Semua</option><option v-for="x in PRIORITIES" :key="x">{{ x }}</option></select></label>
    <label class="f"><span>Kondisi</span><select v-model="st.filters.condition" @change="apply"><option value="">Semua</option><option value="AMAN">Aman</option><option value="TIDAK_AMAN">Tidak Aman</option></select></label>
    <label class="f"><span>PIC</span><select v-model="st.filters.picId" @change="apply"><option value="">Semua</option><option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option></select></label>
    <label class="f"><span>Aktivitas</span><select v-model="st.filters.activity" @change="apply"><option value="">Semua</option><option v-for="x in ACTIVITIES" :key="x" :value="x">{{ label(x) }}</option></select></label>
    <label class="f"><span>Urutkan</span><select v-model="st.filters.sortBy" @change="apply"><option value="createdAt">Created At</option><option value="tanggal">Tanggal</option><option value="reportNumber">Report Number</option><option value="priority">Priority</option><option value="status">Status</option></select></label>
    <label class="f"><span>Arah</span><select v-model="st.filters.sortDir" @change="apply"><option value="desc">Terbaru / Z-A</option><option value="asc">Terlama / A-Z</option></select></label>
    <button class="btn" @click="st.resetFilters(); st.fetchList()">Reset</button>
  </div>
  <div class="card flush">
    <DataState :loading="st.loading" :error="st.error" :empty="!st.reports.length" loading-text="Loading reports..." @retry="st.fetchList()">
      <template #empty>Belum ada laporan Safety Patrol.<br><RouterLink v-if="auth.role === 'PETUGAS'" class="btn primary" to="/reports/create">+ Buat Laporan</RouterLink></template>
      <div class="table-wrap"><table>
        <thead><tr><th>No</th><th>Report Number</th><th>Tanggal</th><th>Depot</th><th>PIC</th><th>Kondisi</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead>
        <tbody><tr v-for="(r, i) in st.reports" :key="r.id">
          <td>{{ (st.pagination.page - 1) * st.pagination.limit + i + 1 }}</td><td>{{ r.reportNumber || 'Draft' }}</td><td>{{ fmtDate(r.tanggal) }}</td><td>{{ r.depotName }}</td><td>{{ r.picName }}</td>
          <td><Badge :value="r.kondisi" kind="condition" /></td><td><Badge :value="r.priority" kind="priority" /></td><td><Badge :value="r.status" /></td>
          <td class="row"><RouterLink class="btn sm" :to="`/reports/${r.id}`"><Eye :size="14" /> View</RouterLink>
            <RouterLink v-if="canEdit(r)" class="btn sm" :to="`/reports/${r.id}/edit`"><Pencil :size="14" /> Edit</RouterLink>
            <button v-if="canDel(r)" class="btn sm danger" @click="del = r"><Trash2 :size="14" /> Delete</button></td>
        </tr></tbody>
      </table></div>
      <Pagination :pagination="st.pagination" @page="(p) => { st.pagination.page = p; st.fetchList() }" />
    </DataState>
  </div>
  <ConfirmModal :open="!!del" title="Delete Report?" :message="`Report ${del?.reportNumber || 'Draft'} will be deleted.`" confirm-text="Delete" danger :busy="busy" @ok="remove" @cancel="del = null" />
</template>
