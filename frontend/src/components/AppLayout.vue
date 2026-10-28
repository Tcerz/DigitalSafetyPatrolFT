<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { notificationService } from '@/services'
import { fmtDateTime } from '@/lib/util'
import { LayoutDashboard, FileText, PlusCircle, BarChart3, Wrench, Bell, User, Users, Building2, Boxes, Container, UserCog, ScrollText, Menu, HardHat, LogOut, ChevronDown, Activity } from 'lucide-vue-next'

const auth = useAuthStore(), route = useRoute(), router = useRouter()
const open = ref(false), dd = ref(''), unread = ref(0), recent = ref([])
const D = { to: '/dashboard', l: 'Dashboard', i: LayoutDashboard }, N = { to: '/notifications', l: 'Notification', i: Bell }, P = { to: '/profile', l: 'Profile', i: User }
const SP = { h: 'Safety Patrol' }
const MENUS = {
  PETUGAS: [D, SP, { to: '/reports', l: 'Laporan Saya', i: FileText, sub: 1 }, { to: '/reports/create', l: 'Buat Laporan', i: PlusCircle, sub: 1 }, N, P],
  ADMIN: [D, SP, { to: '/reports', l: 'Laporan', i: FileText, sub: 1 }, { to: '/corrective-actions', l: 'Corrective Action', i: Wrench }, { to: '/statistics', l: 'Statistics', i: BarChart3 }, { to: '/system-status', l: 'Status Sistem', i: Activity }, N, P],
  SUPERADMIN: [D, SP, { to: '/reports', l: 'Laporan', i: FileText, sub: 1 }, { to: '/corrective-actions', l: 'Corrective Action', i: Wrench }, { to: '/statistics', l: 'Statistics', i: BarChart3 }, { to: '/system-status', l: 'Status Sistem', i: Activity },
    { h: 'Master Data' }, { to: '/depots', l: 'Depot', i: Building2, sub: 1 }, { to: '/master-data/personnel', l: 'Personnel', i: UserCog, sub: 1 }, { to: '/master-data/products', l: 'Product', i: Boxes, sub: 1 }, { to: '/master-data/tanks', l: 'Tank', i: Container, sub: 1 },
    { to: '/users', l: 'Users', i: Users }, { to: '/audit-logs', l: 'Audit Log', i: ScrollText }, N, P],
}
const appVersion = import.meta.env.VITE_APP_VERSION || 'dev'
const appCommit = import.meta.env.VITE_GIT_COMMIT || 'local'
const menu = computed(() => MENUS[auth.role] || [])
const crumbs = computed(() => String(route.meta.crumb || '').split(' / '))

async function loadNotif() {
  try {
    const r = await notificationService.list({ unread: true, limit: 5 })
    recent.value = r.data || []
    unread.value = r.pagination?.total ?? recent.value.length
  } catch { /* header tetap berfungsi tanpa notifikasi */ }
}
let timer
onMounted(() => { loadNotif(); timer = setInterval(loadNotif, 60000); document.addEventListener('click', close) })
onBeforeUnmount(() => { clearInterval(timer); document.removeEventListener('click', close) })
const close = () => (dd.value = '')
const toggle = (k) => (dd.value = dd.value === k ? '' : k)
async function keluar() { await auth.logout(); router.push('/login') }
</script>

<template>
  <div class="shell">
    <div v-if="open" class="overlay" @click="open = false" />
    <aside class="sidebar" :class="{ open }" @click="open = false">
      <div class="brand"><HardHat :size="26" /><div><b>DIGITAL SAFETY PATROL</b><small>Fuel Terminal</small></div></div>
      <nav>
        <template v-for="m in menu" :key="m.l || m.h">
          <div v-if="m.h" class="nav-h">{{ m.h }}</div>
          <RouterLink v-else :to="m.to" class="nav" :class="{ sub: m.sub }" exact-active-class="active" active-class=""><component :is="m.i" :size="16" />{{ m.l }}</RouterLink>
        </template>
      </nav>
      <div class="app-ver" title="Versi aplikasi (diisi pipeline CI/CD)">v{{ appVersion }} &middot; {{ appCommit }}</div>
    </aside>
    <div class="main">
      <header class="header">
        <button class="icon-btn menu-btn" aria-label="Buka menu" @click="open = true"><Menu :size="20" /></button>
        <div class="crumbs"><b>Digital Safety Patrol</b> &nbsp;/&nbsp; {{ crumbs.join(' / ') }}</div>
        <div class="spacer" />
        <div class="dd" @click.stop>
          <button class="icon-btn" aria-label="Notifikasi" @click="toggle('n')"><Bell :size="20" /><span v-if="unread" class="dot">{{ unread }}</span></button>
          <div v-if="dd === 'n'" class="dd-menu">
            <div v-if="!recent.length" class="state">Tidak ada notifikasi baru.</div>
            <RouterLink v-for="n in recent" :key="n.id" to="/notifications" @click="close">{{ n.message }}<br><small>{{ fmtDateTime(n.createdAt) }}</small></RouterLink>
            <RouterLink to="/notifications" @click="close"><b>Lihat semua</b></RouterLink>
          </div>
        </div>
        <div class="dd" @click.stop>
          <button class="icon-btn" @click="toggle('u')"><User :size="18" /> {{ auth.user?.name }} <small>({{ auth.role }})</small><ChevronDown :size="14" /></button>
          <div v-if="dd === 'u'" class="dd-menu">
            <RouterLink to="/profile" @click="close">Profile</RouterLink>
            <button @click="keluar"><LogOut :size="14" /> Logout</button>
          </div>
        </div>
      </header>
      <div class="hazard" />
      <main class="content"><RouterView :key="route.fullPath" /></main>
    </div>
  </div>
</template>

<style>
.app-ver { margin-top: 24px; padding: 8px 12px; font-size: 12px; color: #7d8da1; border-top: 1px solid #2a3b50; word-break: break-all; }
</style>
