<script setup>
defineProps({ open: Boolean, title: String, message: String, confirmText: String, danger: Boolean, busy: Boolean })
defineEmits(['ok', 'cancel'])
</script>
<template>
  <Teleport to="body">
    <div v-if="open" class="modal-bg" @keydown.esc="$emit('cancel')">
      <div class="modal" role="dialog" aria-modal="true">
        <h3>{{ title }}</h3>
        <p v-if="message" style="white-space:pre-line">{{ message }}</p>
        <slot />
        <div class="row end">
          <button class="btn" @click="$emit('cancel')">Cancel</button>
          <button class="btn" :class="danger ? 'danger' : 'primary'" :disabled="busy" @click="$emit('ok')">{{ busy ? 'Memproses...' : confirmText || 'OK' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
