<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Eye, EyeOff } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore(), route = useRoute(), router = useRouter()
const f = ref({ username: '', password: '' }), show = ref(false), busy = ref(false), error = ref('')
async function submit() {
  if (busy.value) return
  if (!f.value.username || !f.value.password) { error.value = 'Username/email dan password wajib diisi.'; return }
  busy.value = true; error.value = ''
  try { await auth.login(f.value); router.push(route.query.redirect || '/dashboard') }
  catch (e) { error.value = e.response && e.response.status < 500 ? 'Username atau password tidak valid.' : e.userMessage }
  finally { busy.value = false }
}
</script>
<template>
  <div class="login">
    <form class="login-card" @submit.prevent="submit">
      <h1>DIGITAL SAFETY<br>PATROL</h1>
      <label class="f"><span>Username / Email</span><input v-model.trim="f.username" autocomplete="username" autofocus /></label>
      <label class="f"><span>Password</span>
        <div class="row" style="flex-wrap:nowrap"><input v-model="f.password" :type="show ? 'text' : 'password'" autocomplete="current-password" />
          <button type="button" class="icon-btn" :aria-label="show ? 'Sembunyikan password' : 'Tampilkan password'" @click="show = !show"><component :is="show ? EyeOff : Eye" :size="18" /></button></div>
      </label>
      <p v-if="error" class="err-t" role="alert">{{ error }}</p>
      <button class="btn primary" style="width:100%;justify-content:center" :disabled="busy">{{ busy ? 'Memproses...' : 'LOGIN' }}</button>
    </form>
  </div>
</template>
