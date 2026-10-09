<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { correctiveActionService } from '@/services'
import { fmtDate, fmtDateTime, isOverdue, label } from '@/lib/util'
import DataState from '@/components/DataState.vue'
import Badge from '@/components/Badge.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'

const id = useRoute().params.id, ui = useUiStore()
const c = ref(null), loading = ref(true), error = ref(''), status = ref(''), notes = ref(''), confirm = ref(false), busy = ref(false)
async function load() {
  loading.value = true; error.value = ''
  try { c.value = (await correctiveActionService.get(id)).data; status.value = c.value.status; notes.value = c.value.notes || '' }
  catch (e) { error.value = e.userMessage } finally { loading.value = false }
}
const save = () => (status.value === 'CLOSED' && c.value.status !== 'CLOSED' ? (confirm.value = true) : doSave())
async function doSave() {
  busy.value = true
  try { await correctiveActionService.update(id, { status: status.value, notes: notes.value }); ui.toast('Data berhasil diperbarui.'); confirm.value = false; await load() }
  catch (e) { ui.toast(e.userMessage || 'Gagal menyimpan.', 'error') } finally { busy.value = false }
}
onMounted(load)
</script>
<template>
  <DataState :loading="loading" :error="error" @retry="load"><template v-if="c">
    <div class="page-head"><h1>Corrective Action</h1><Badge :value="c.status" /></div>
    <div class="card"><dl class="dl"><dt>Finding</dt><dd>{{ c.findingTitle }}</dd><dt>Action</dt><dd>{{ c.action }}</dd><dt>Assigned PIC</dt><dd>{{ c.picName }}</dd>
      <dt>Target Date</dt><dd>{{ fmtDate(c.targetDate) }} <span v-if="isOverdue(c)" class="overdue">⚠ OVERDUE</span></dd>
      <dt>Laporan</dt><dd><RouterLink :to="`/reports/${c.reportId}`">{{ c.reportNumber }}</RouterLink></dd></dl></div>
    <div class="card"><h2>Evidence</h2><div class="ba"><div><b>BEFORE</b><img v-if="c.beforePhotoUrl" :src="c.beforePhotoUrl" alt="Before" /><small v-else><br>Belum ada foto.</small></div><ArrowRight /><div><b>AFTER</b><img v-if="c.afterPhotoUrl" :src="c.afterPhotoUrl" alt="After" /><small v-else><br>Belum ada foto.</small></div></div></div>
    <div class="card"><h2>Update</h2>
      <label class="f"><span>Status</span><select v-model="status"><option v-for="s in ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']" :key="s" :value="s">{{ label(s) }}</option></select></label>
      <label class="f"><span>Notes</span><textarea v-model="notes" /></label>
      <button class="btn primary" :disabled="busy" @click="save">{{ busy ? 'Saving...' : 'Simpan' }}</button></div>
    <div class="card"><h2>History</h2><small v-if="!c.history?.length">Belum ada riwayat.</small>
      <div v-for="h in c.history" :key="h.createdAt" style="margin-bottom:8px"><b>{{ fmtDateTime(h.createdAt) }}</b><br>{{ label(h.status) }} by {{ h.byName }}</div></div>
    <ConfirmModal :open="confirm" title="Close Corrective Action?" message="Tindak lanjut yang ditutup tidak dapat dibuka kembali dari antarmuka ini." confirm-text="Close" :busy="busy" @ok="doSave" @cancel="confirm = false" />
  </template></DataState>
</template>
