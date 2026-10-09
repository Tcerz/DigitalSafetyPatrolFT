<script setup>
import { ref, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui'
import { notificationService } from '@/services'
import { fmtDateTime } from '@/lib/util'
import DataState from '@/components/DataState.vue'
import Pagination from '@/components/Pagination.vue'

const ui = useUiStore()
const rows = ref([]), tab = ref('all'), loading = ref(true), error = ref('')
const pg = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })
async function load() {
  loading.value = true; error.value = ''
  try { const r = await notificationService.list({ page: pg.value.page, limit: pg.value.limit, ...(tab.value === 'unread' ? { unread: true } : {}) }); rows.value = r.data || []; if (r.pagination) pg.value = { ...pg.value, ...r.pagination } }
  catch (e) { error.value = e.userMessage || 'Tidak dapat mengambil notifikasi.' } finally { loading.value = false }
}
const setTab = (t) => { tab.value = t; pg.value.page = 1; load() }
async function read(n) { try { await notificationService.markRead(n.id); n.read = true } catch (e) { ui.toast(e.userMessage, 'error') } }
async function readAll() { try { await notificationService.markAllRead(); ui.toast('Semua notifikasi ditandai dibaca.'); load() } catch (e) { ui.toast(e.userMessage, 'error') } }
onMounted(load)
</script>
<template>
  <div class="page-head"><h1>Notification</h1>
    <div class="row"><button class="btn" :class="{ primary: tab === 'all' }" @click="setTab('all')">All</button><button class="btn" :class="{ primary: tab === 'unread' }" @click="setTab('unread')">Unread</button><button class="btn" @click="readAll">Mark All as Read</button></div></div>
  <div class="card flush"><DataState :loading="loading" :error="error" :empty="!rows.length" empty-text="Tidak ada notifikasi." @retry="load">
    <div v-for="n in rows" :key="n.id" class="row" :class="{ unread: !n.read }" style="padding:12px 16px;border-bottom:1px solid var(--line)">
      <div><b>{{ n.message }}</b><br><small>{{ fmtDateTime(n.createdAt) }}</small></div><span class="spacer" />
      <RouterLink v-if="n.link" class="btn sm" :to="n.link" @click="read(n)">Buka</RouterLink><button v-if="!n.read" class="btn sm" @click="read(n)">Mark as Read</button></div>
    <Pagination :pagination="pg" @page="(p) => { pg.page = p; load() }" />
  </DataState></div>
</template>
