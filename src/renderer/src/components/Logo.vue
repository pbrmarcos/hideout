<script setup lang="ts">
defineProps<{ size?: number }>()
</script>

<template>
  <svg :width="size ?? 20" :height="size ?? 20" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--hx-primary)" />
    <circle cx="12" cy="10" r="2.6" fill="var(--hx-surface)" />
    <path d="M10.9 11.5h2.2l.7 5h-3.6z" fill="var(--hx-surface)" />
  </svg>
</template>
