<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { copied } from '../copy'
import { t } from '../i18n'

const props = defineProps<{ copyKey: string; value: string; shown?: boolean; label?: string }>()
const emit = defineEmits<{ copy: [] }>()

const tick = ref(Date.now())
const timer = setInterval(() => (tick.value = Date.now()), 250)
onBeforeUnmount(() => clearInterval(timer))

const isCopied = computed(() => copied.key === props.copyKey)
const left = computed(() => {
  if (!isCopied.value) return 0
  return Math.max(0, 1 - (tick.value - copied.startedAt) / copied.ms)
})
const seconds = computed(() => Math.ceil((left.value * copied.ms) / 1000))
</script>

<template>
  <button
    class="seal"
    :data-seal="copyKey"
    :class="{ copied: isCopied, shown: shown && !isCopied }"
    :aria-label="isCopied ? t('Copiada, sai da área de transferência em {seconds} segundos', { seconds }) : t('Copiar {what}', { what: label ?? t('senha') })"
    :title="isCopied ? t('Limpa em {seconds} s', { seconds }) : t('Clique para copiar')"
    @click.stop="emit('copy')"
  >
    <template v-if="isCopied">
      <UIcon name="i-lucide-check" class="size-[14px]" />{{ t('Copiada') }}
      <span class="drain" :style="{ width: `${left * 100}%` }" />
    </template>
    <span v-else-if="shown" class="mono txt">{{ value }}</span>
    <template v-else>
      <span v-for="i in 8" :key="i" class="dot" />
    </template>
  </button>
</template>

<style scoped>
.seal {
  position: relative;
  height: 30px;
  min-width: 104px;
  max-width: 180px;
  box-sizing: border-box;
  border: 0;
  border-radius: 15px;
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  font: inherit;
  padding: 0 12px;
  overflow: hidden;
  flex-shrink: 0;
  transition: background-color 0.18s, color 0.18s, box-shadow 0.18s;
}
.seal:hover {
  filter: brightness(0.97);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: var(--hx-dot);
}
.copied {
  background: var(--hx-primary);
  color: var(--hx-on-primary);
  font-weight: 600;
  font-size: 12.5px;
  gap: 6px;
  box-shadow: var(--hx-glow);
}
.drain {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  background: color-mix(in srgb, var(--hx-on-primary) 55%, transparent);
  transition: width 0.25s linear;
}
.shown {
  background: var(--hx-bg);
  box-shadow: inset 0 0 0 1px var(--hx-line);
  color: var(--hx-ink);
}
.txt {
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
