<script setup>
import { computed } from 'vue'
import { CheckCircle2, AlertTriangle } from 'lucide-vue-next'
import { label } from '@/lib/util'
const p = defineProps({ value: String, kind: { type: String, default: 'status' } })
const STATUS = { DRAFT: 'neutral', SUBMITTED: 'info', VERIFIED: 'info', IN_PROGRESS: 'warning', RESOLVED: 'success', CLOSED: 'neutral', OPEN: 'danger' }
const PRIORITY = { LOW: 'neutral', MEDIUM: 'warning', HIGH: 'danger', CRITICAL: 'danger-solid' }
const tone = computed(() =>
  p.kind === 'condition' ? (p.value === 'AMAN' ? 'success' : 'danger')
  : p.kind === 'priority' ? PRIORITY[p.value] || 'neutral' : STATUS[p.value] || 'neutral')
</script>
<template>
  <span v-if="value" class="badge" :class="'b-' + tone">
    <CheckCircle2 v-if="kind === 'condition' && value === 'AMAN'" :size="13" />
    <AlertTriangle v-else-if="kind === 'condition' || value === 'CRITICAL'" :size="13" />
    {{ label(value) }}
  </span>
  <span v-else>-</span>
</template>
