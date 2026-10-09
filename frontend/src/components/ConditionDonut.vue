<script setup>
import { computed } from 'vue'
const p = defineProps({ safe: { type: Number, default: 0 }, unsafe: { type: Number, default: 0 } })
const total = computed(() => p.safe + p.unsafe)
const bg = computed(() => `conic-gradient(var(--ok) 0 ${total.value ? (p.safe / total.value) * 100 : 0}%, var(--bad) 0 100%)`)
</script>
<template>
  <div class="donut" :style="{ background: total ? bg : 'var(--neubg)' }"><span>{{ total }}</span></div>
  <div class="row" style="justify-content:center;margin-top:8px"><span class="badge b-success">Safe {{ safe }}</span><span class="badge b-danger">Unsafe {{ unsafe }}</span></div>
</template>
