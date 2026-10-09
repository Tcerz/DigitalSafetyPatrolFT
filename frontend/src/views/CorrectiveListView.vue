<script setup>
import { ref, reactive, onMounted } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { correctiveActionService, depotService, personnelService } from '@/services'
import { clean, fmtDate, isOverdue, PRIORITIES, label } from '@/lib/util'
import DataState from '@/components/DataState.vue'
import Pagination from '@/components/Pagination.vue'
import Badge from '@/components/Badge.vue'

const auth = useAuthStore()
const rows = ref([]), loading = ref(true), error = ref(''), depots = ref([]), people = ref([])
const pg = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
const f = reactive({ status: '', picId: '', priority: '', targetDate: '', depotId: '' })
async function load() {
  loading.value = true; error.value = ''
  try { const r = await correctiveActionService.list({ ...clean(f), page: pg.value.page, limit: pg.value.limit }); rows.value = r.data || []; if (r.pagination) pg.value = { ...pg.value, ...r.pagination } }
  catch (e) { error.value = e.userMessage || 'Tidak dapat mengambil data corrective action.' } finally { loading.value = false }
}
const apply = () => { pg.value.page = 1; load() }
onMounted(async () => {
  try { if (auth.role === 'SUPERADMIN') depots.value = (await depotService.list({ limit: 200 })).data; people.value = (await personnelService.list({ limit: 200 })).data } catch { /* filter opsional */ }
  load()
})
</script>
<template>
  <div class="page-head"><h1>Corrective Actions</h1><button class="btn" @click="load"><RefreshCw :size="15" /> Refresh</button></div>
  <div class="card filters">
    <label class="f"><span>Status</span><select v-model="f.status" @change="apply"><option value="">Semua</option><option v-for="x in ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']" :key="x" :value="x">{{ label(x) }}</option></select></label>
    <label class="f"><span>PIC</span><select v-model="f.picId" @change="apply"><option value="">Semua</option><option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option></select></label>
    <label class="f"><span>Priority</span><select v-model="f.priority" @change="apply"><option value="">Semua</option><option v-for="x in PRIORITIES" :key="x">{{ x }}</option></select></label>
    <label class="f"><span>Target Date</span><input type="date" v-model="f.targetDate" @change="apply" /></label>
    <label v-if="auth.role === 'SUPERADMIN'" class="f"><span>Depot</span><select v-model="f.depotId" @change="apply"><option value="">Semua</option><option v-for="d in depots" :key="d.id" :value="d.id">{{ d.name }}</option></select></label>
  </div>
  <div class="card flush"><DataState :loading="loading" :error="error" :empty="!rows.length" empty-text="Belum ada corrective action." @retry="load">
    <div class="table-wrap"><table><thead><tr><th>Finding</th><th>Action</th><th>PIC</th><th>Target Date</th><th>Status</th><th>Priority</th><th>Action</th></tr></thead>
      <tbody><tr v-for="c in rows" :key="c.id"><td>{{ c.findingTitle }}</td><td>{{ c.action }}</td><td>{{ c.picName }}</td>
        <td>{{ fmtDate(c.targetDate) }} <span v-if="isOverdue(c)" class="overdue">⚠ OVERDUE</span></td><td><Badge :value="c.status" /></td><td><Badge :value="c.priority" kind="priority" /></td>
        <td><RouterLink class="btn sm" :to="`/corrective-actions/${c.id}`">Detail</RouterLink></td></tr></tbody></table></div>
    <Pagination :pagination="pg" @page="(p) => { pg.page = p; load() }" />
  </DataState></div>
</template>
