import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { CRUDS } from '@/lib/cruds'

const ALL = ['PETUGAS', 'ADMIN', 'SUPERADMIN']
const ADM = ['ADMIN', 'SUPERADMIN']
const SA = ['SUPERADMIN']
const v = (n) => () => import(`../views/${n}.vue`)

const crudRoutes = Object.entries(CRUDS).flatMap(([key, c]) => {
  const list = { path: c.path, name: `${key}-list`, component: v('CrudView'), meta: { roles: SA, crud: key, crumb: c.title } }
  if (c.readonly) return [list]
  return [
    list,
    { path: `${c.path}/create`, name: `${key}-create`, component: v('CrudView'), meta: { roles: SA, crud: key, crumb: `${c.title} / Create` } },
    { path: `${c.path}/:id/edit`, name: `${key}-edit`, component: v('CrudView'), meta: { roles: SA, crud: key, crumb: `${c.title} / Edit` } },
  ]
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: v('LoginView'), meta: { public: true } },
    {
      path: '/', component: () => import('../components/AppLayout.vue'), redirect: '/dashboard',
      children: [
        { path: 'dashboard', component: v('DashboardView'), meta: { roles: ALL, crumb: 'Dashboard' } },
        { path: 'reports', component: v('ReportListView'), meta: { roles: ALL, crumb: 'Dashboard / Reports' } },
        { path: 'reports/create', component: v('ReportFormView'), meta: { roles: ['PETUGAS'], crumb: 'Reports / Create' } },
        { path: 'reports/:id', component: v('ReportDetailView'), meta: { roles: ALL, crumb: 'Reports / Detail' } },
        { path: 'reports/:id/edit', component: v('ReportFormView'), meta: { roles: ['PETUGAS', 'SUPERADMIN'], crumb: 'Reports / Edit' } },
        { path: 'statistics', component: v('StatisticsView'), meta: { roles: ADM, crumb: 'Statistics' } },
        { path: 'corrective-actions', component: v('CorrectiveListView'), meta: { roles: ADM, crumb: 'Corrective Actions' } },
        { path: 'corrective-actions/:id', component: v('CorrectiveDetailView'), meta: { roles: ADM, crumb: 'Corrective Actions / Detail' } },
        ...crudRoutes,
        { path: 'notifications', component: v('NotificationsView'), meta: { roles: ALL, crumb: 'Notification' } },
        { path: 'profile', component: v('ProfileView'), meta: { roles: ALL, crumb: 'Profile' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.init()
  if (to.meta.public) return auth.isAuthenticated ? '/dashboard' : true
  if (!auth.isAuthenticated) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) {
    useUiStore().toast('Anda tidak memiliki akses ke halaman tersebut.', 'error')
    return '/dashboard'
  }
})

export default router
