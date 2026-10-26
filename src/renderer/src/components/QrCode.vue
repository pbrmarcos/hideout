<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{ value: string; size?: number; label: string }>()
const src = ref('')

watchEffect(async () => {
  src.value = await QRCode.toDataURL(props.value, { margin: 1, width: (props.size ?? 176) * 2, color: { dark: '#111111', light: '#ffffff' } })
})
</script>

<template>
  <img v-if="src" :src="src" :width="size ?? 176" :height="size ?? 176" :alt="label" class="qr" />
</template>

<style scoped>
.qr {
  border-radius: 10px;
  background: #fff;
  padding: 8px;
  box-shadow: 0 0 0 1px var(--hx-line);
  image-rendering: pixelated;
}
</style>
