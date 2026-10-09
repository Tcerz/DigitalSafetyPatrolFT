<script setup>
import { computed } from 'vue'
const p = defineProps({ pagination: Object })
defineEmits(['page'])
const from = computed(() => (p.pagination.total ? (p.pagination.page - 1) * p.pagination.limit + 1 : 0))
const to = computed(() => Math.min(p.pagination.page * p.pagination.limit, p.pagination.total))
const pages = computed(() => {
  const t = p.pagination.totalPages || 1, c = p.pagination.page
  return Array.from({ length: t }, (_, i) => i + 1).filter((n) => n === 1 || n === t || Math.abs(n - c) <= 2)
})
</script>
<template>
  <div class="pager">
    <small>Showing {{ from }}–{{ to }} of {{ pagination.total }}</small>
    <div class="row">
      <button class="btn sm" :disabled="pagination.page <= 1" @click="$emit('page', pagination.page - 1)">&lt;</button>
      <button v-for="n in pages" :key="n" class="btn sm" :class="{ primary: n === pagination.page }" @click="$emit('page', n)">{{ n }}</button>
      <button class="btn sm" :disabled="pagination.page >= pagination.totalPages" @click="$emit('page', pagination.page + 1)">&gt;</button>
    </div>
  </div>
</template>
