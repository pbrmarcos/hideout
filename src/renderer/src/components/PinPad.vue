<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { t } from '../i18n'

const pin = defineModel<string>({ required: true })
const props = defineProps<{ disabled?: boolean; error?: boolean }>()
const emit = defineEmits<{ complete: [pin: string] }>()

// Local copy: the model only updates on the next render, and fast typing must not lose digits.
let cur = pin.value
watch(pin, (v) => (cur = v))

function set(v: string): void {
  cur = v
  pin.value = v
}
function press(d: string): void {
  if (props.disabled || cur.length >= 6) return
  set(cur + d)
  if (cur.length === 6) emit('complete', cur)
}
const back = (): void => set(cur.slice(0, -1))
const clear = (): void => set('')

function onKey(e: KeyboardEvent): void {
  if (props.disabled) return
  if (/^\d$/.test(e.key)) press(e.key)
  else if (e.key === 'Backspace') back()
  else if (e.key === 'Escape') clear()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="wrap">
    <div class="pins" :class="{ shake: error }" role="status" :aria-label="t('{n} de 6 dígitos', { n: pin.length })">
      <span v-for="i in 6" :key="i" :class="{ f: i <= pin.length }" />
    </div>
    <div class="pad">
      <button v-for="n in ['1', '2', '3', '4', '5', '6', '7', '8', '9']" :key="n" class="k" :disabled="disabled" @click="press(n)">{{ n }}</button>
      <button class="k n" :disabled="disabled" @click="clear">{{ t('Limpar') }}</button>
      <button class="k" :disabled="disabled" @click="press('0')">0</button>
      <button class="k n" :disabled="disabled" :aria-label="t('Apagar')" @click="back"><UIcon name="i-lucide-delete" class="size-[22px]" /></button>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
}
.pins {
  display: flex;
  gap: 14px;
}
.pins span {
  width: 16px;
  height: 16px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 2px var(--hx-muted);
  transition: background-color 0.12s;
}
.pins span.f {
  background: var(--hx-primary);
  box-shadow: var(--hx-glow);
}
.shake {
  animation: shake 0.35s;
}
@keyframes shake {
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}
.pad {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: min(300px, 100%);
}
.k {
  height: 58px;
  border-radius: 16px;
  border: 0;
  background: var(--hx-surface);
  font: inherit;
  font-size: 22px;
  font-weight: 600;
  color: var(--hx-ink);
  cursor: pointer;
  box-shadow: 0 1px 0 var(--hx-line);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.12s;
}
.k:hover:not(:disabled) {
  background: var(--hx-line);
}
.k:active:not(:disabled) {
  background: var(--hx-soft);
}
.k.n {
  background: transparent;
  box-shadow: none;
  font-size: 14px;
  color: var(--hx-muted);
}
</style>
