<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{ title: string; back?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const root = ref<HTMLElement | null>(null)

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && !document.querySelector('[role="dialog"][data-state="open"]')) emit('close')
}
onMounted(async () => {
  window.addEventListener('keydown', onKey)
  await nextTick()
  root.value?.querySelector<HTMLElement>('[autofocus], input, textarea')?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <section ref="root" class="sheet" role="dialog" :aria-label="title">
    <div class="head">
      <button class="hx-ib" :aria-label="back ? 'Voltar' : 'Fechar'" @click="emit('close')">
        <UIcon :name="back ? 'i-lucide-chevron-left' : 'i-lucide-x'" class="size-[18px]" />
      </button>
      <h1>{{ title }}</h1>
      <slot name="actions" />
    </div>
    <div class="body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="foot">
      <slot name="footer" />
    </div>
  </section>
</template>

<style scoped>
.sheet {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: var(--hx-surface);
  border-radius: 14px 14px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 30px rgb(0 0 0 / 0.1);
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 10px 10px 12px;
  border-bottom: 1px solid var(--hx-line);
}
h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  flex-grow: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.body {
  flex-grow: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--hx-line);
}
</style>
