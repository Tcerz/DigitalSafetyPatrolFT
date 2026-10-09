<script setup>
import { useUiStore } from '@/stores/ui'
const ui = useUiStore()
</script>
<template>
  <RouterView />
  <div class="toasts" aria-live="polite">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.type" @click="ui.remove(t.id)">
      {{ t.type === 'error' ? '✕' : '✓' }} {{ t.message }}
    </div>
  </div>
</template>
