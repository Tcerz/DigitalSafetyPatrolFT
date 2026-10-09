<script setup>
defineProps({ loading: Boolean, error: String, empty: Boolean, emptyText: String, loadingText: String })
defineEmits(['retry'])
</script>
<template>
  <div v-if="loading" class="state"><span class="spin" /> {{ loadingText || 'Memuat data...' }}</div>
  <div v-else-if="error" class="state err">{{ error }} <button class="btn" @click="$emit('retry')">Coba Lagi</button></div>
  <div v-else-if="empty" class="state"><slot name="empty">{{ emptyText || 'Tidak ada data.' }}</slot></div>
  <slot v-else />
</template>
