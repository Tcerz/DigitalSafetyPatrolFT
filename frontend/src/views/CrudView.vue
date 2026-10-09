<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { CRUDS, LOOKUPS } from '@/lib/cruds'
import { clean, fmtDateTime, opt } from '@/lib/util'
import DataState from '@/components/DataState.vue'
import Pagination from '@/components/Pagination.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'

const route = useRoute(), router = useRouter(), ui = useUiStore()
const cfg = CRUDS[route.meta.crud], name = String(route.name)
const mode = name.endsWith('-create') ? 'create' : name.endsWith('-edit') ? 'edit' : 'list'
const base = `/${cfg.path}`
// list
const rows = ref([]), loading = ref(mode === 'list'), error = ref(''), del = ref(null), busy = ref(false), search = ref('')
const flt = reactive(Object.fromEntries((cfg.filters || []).map((x) => [x.k, ''])))
const pg = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
// form
const form = reactive({}), errs = ref({}), lookups = reactive({}), saving = ref(false)
const fields = computed(() => (cfg.fields || []).filter((x) => !(x.createOnly && mode === 'edit')))
const cell = (r, c) => (c[2] === 'dt' ? fmtDateTime(r[c[0]]) : r[c[0]] ?? '-')

async function load() {
  loading.value = true; error.value = ''
  try {
    const r = await cfg.service.list({ ...clean(flt), ...(search.value ? { search: search.value } : {}), page: pg.value.page, limit: pg.value.limit })
    rows.value = r.data || []; if (r.pagination) pg.value = { ...pg.value, ...r.pagination }
  } catch (e) { error.value = e.userMessage || 'Tidak dapat mengambil data.' } finally { loading.value = false }
}
const apply = () => { pg.value.page = 1; load() }
async function remove() {
  busy.value = true
  try { await cfg.service.remove(del.value.id); ui.toast('Data berhasil dihapus.'); del.value = null; load() }
  catch (e) { ui.toast(e.userMessage || 'Gagal menghapus data.', 'error') } finally { busy.value = false }
}
async function initForm() {
  loading.value = true
  try {
    for (const f of cfg.fields) { form[f.k] = ''; if (f.lookup && !lookups[f.lookup]) lookups[f.lookup] = (await LOOKUPS[f.lookup].list({ limit: 200 })).data.map(opt) }
    if (mode === 'edit') Object.assign(form, (await cfg.service.get(route.params.id)).data, { password: '' })
    else form.status = 'ACTIVE'
  } catch (e) { error.value = e.userMessage } finally { loading.value = false }
}
async function save() {
  const e = {}
  fields.value.forEach((f) => { if (f.req && (form[f.k] === '' || form[f.k] == null) && !(f.k === 'password')) e[f.k] = 'Field ini wajib diisi.' })
  if (mode === 'create' && cfg.fields.some((f) => f.k === 'password') && !form.password) e.password = 'Field ini wajib diisi.'
  errs.value = e
  if (Object.keys(e).length) return
  saving.value = true
  try {
    const body = clean({ ...form }); if (mode === 'edit') delete body.password
    mode === 'edit' ? await cfg.service.update(route.params.id, body) : await cfg.service.create(body)
    ui.toast('Data berhasil disimpan.'); router.push(base)
  } catch (er) { ui.toast(er.userMessage || 'Gagal menyimpan data.', 'error') } finally { saving.value = false }
}
onMounted(() => (mode === 'list' ? load() : initForm()))
</script>
<template>
  <template v-if="mode === 'list'">
    <div class="page-head"><h1>{{ cfg.title }}</h1><div class="row"><button class="btn" @click="load"><RefreshCw :size="15" /> Refresh</button>
      <RouterLink v-if="!cfg.readonly" class="btn primary" :to="`${base}/create`"><Plus :size="15" /> Create</RouterLink></div></div>
    <div class="card filters">
      <label v-if="!cfg.filters" class="f"><span>Cari</span><input v-model="search" @keyup.enter="apply" placeholder="Ketik lalu Enter" /></label>
      <label v-for="x in cfg.filters" :key="x.k" class="f"><span>{{ x.l }}</span><input :type="x.type || 'text'" v-model="flt[x.k]" @change="apply" @keyup.enter="apply" /></label>
    </div>
    <div class="card flush"><DataState :loading="loading" :error="error" :empty="!rows.length" empty-text="Belum ada data." @retry="load">
      <div class="table-wrap"><table><thead><tr><th v-for="c in cfg.cols" :key="c[0]">{{ c[1] }}</th><th v-if="!cfg.readonly">Action</th></tr></thead>
        <tbody><tr v-for="r in rows" :key="r.id"><td v-for="c in cfg.cols" :key="c[0]">{{ cell(r, c) }}</td>
          <td v-if="!cfg.readonly" class="row"><RouterLink class="btn sm" :to="`${base}/${r.id}/edit`"><Pencil :size="14" /> Edit</RouterLink><button class="btn sm danger" @click="del = r"><Trash2 :size="14" /> Delete</button></td></tr></tbody></table></div>
      <Pagination :pagination="pg" @page="(p) => { pg.page = p; load() }" />
    </DataState></div>
    <ConfirmModal :open="!!del" :title="`Delete ${cfg.title}?`" message="Data yang dihapus tidak dapat dikembalikan." confirm-text="Delete" danger :busy="busy" @ok="remove" @cancel="del = null" />
  </template>
  <template v-else>
    <div class="page-head"><h1>{{ mode === 'create' ? 'Create' : 'Edit' }} {{ cfg.title }}</h1></div>
    <DataState :loading="loading" :error="error" @retry="initForm"><form class="card" style="max-width:640px" @submit.prevent="save">
      <label v-for="f in fields" :key="f.k" class="f"><span>{{ f.l }} <b v-if="f.req || f.k === 'password'" class="req">*</b></span>
        <select v-if="f.type === 'select'" v-model="form[f.k]"><option value="">Pilih</option><option v-for="o in f.opts || lookups[f.lookup]" :key="o.value" :value="o.value">{{ o.label }}</option></select>
        <input v-else v-model="form[f.k]" :type="f.type || 'text'" :autocomplete="f.type === 'password' ? 'new-password' : 'off'" />
        <span v-if="errs[f.k]" class="err-t">{{ errs[f.k] }}</span></label>
      <div class="row end"><RouterLink class="btn" :to="base">Cancel</RouterLink><button class="btn primary" :disabled="saving">{{ saving ? 'Saving...' : 'Simpan' }}</button></div>
    </form></DataState>
  </template>
</template>
