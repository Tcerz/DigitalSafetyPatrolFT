<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { authService } from '@/services'
const auth = useAuthStore(), ui = useUiStore()
const pw = ref({ currentPassword: '', newPassword: '', confirm: '' }), busy = ref(false), error = ref('')
async function change() {
  error.value = ''
  if (pw.value.newPassword.length < 8) { error.value = 'Password baru minimal 8 karakter.'; return }
  if (pw.value.newPassword !== pw.value.confirm) { error.value = 'Konfirmasi password tidak sama.'; return }
  busy.value = true
  try { await authService.changePassword({ currentPassword: pw.value.currentPassword, newPassword: pw.value.newPassword }); ui.toast('Password berhasil diubah.'); pw.value = { currentPassword: '', newPassword: '', confirm: '' } }
  catch (e) { error.value = e.userMessage || 'Gagal mengubah password.' } finally { busy.value = false }
}
</script>
<template>
  <div class="page-head"><h1>Profile</h1></div>
  <div class="card"><dl class="dl"><dt>Name</dt><dd>{{ auth.user.name }}</dd><dt>Username</dt><dd>{{ auth.user.username }}</dd><dt>Email</dt><dd>{{ auth.user.email }}</dd><dt>Role</dt><dd>{{ auth.user.role }}</dd><dt>Depot</dt><dd>{{ auth.user.depotName || '-' }}</dd><dt>Status</dt><dd>{{ auth.user.status }}</dd></dl></div>
  <form class="card" style="max-width:420px" @submit.prevent="change"><h2>Change Password</h2>
    <label class="f"><span>Password saat ini</span><input type="password" v-model="pw.currentPassword" autocomplete="current-password" required /></label>
    <label class="f"><span>Password baru</span><input type="password" v-model="pw.newPassword" autocomplete="new-password" required /></label>
    <label class="f"><span>Konfirmasi password baru</span><input type="password" v-model="pw.confirm" autocomplete="new-password" required /></label>
    <p v-if="error" class="err-t" role="alert">{{ error }}</p>
    <button class="btn primary" :disabled="busy">{{ busy ? 'Saving...' : 'Ubah Password' }}</button></form>
</template>
