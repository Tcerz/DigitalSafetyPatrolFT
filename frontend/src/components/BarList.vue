<script setup>
import { computed } from 'vue'
const p = defineProps({ items: { type: Array, default: () => [] }, vertical: Boolean })
const max = computed(() => Math.max(1, ...p.items.map((i) => i.value)))
</script>
<template>
  <div v-if="!items.length" class="state">Belum ada data.</div>
  <div v-else-if="vertical" class="vbars">
    <div v-for="i in items" :key="i.label" class="vbar"><span>{{ i.value }}</span><i :style="{ height: (i.value / max) * 100 + '%' }" /><small>{{ i.label }}</small></div>
  </div>
  <div v-else class="bars">
    <div v-for="i in items" :key="i.label" class="bar-row"><span>{{ i.label }}</span><div class="bar"><i :style="{ width: (i.value / max) * 100 + '%' }" /></div><b>{{ i.value }}</b></div>
  </div>
</template>
