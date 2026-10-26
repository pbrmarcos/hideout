<script setup lang="ts">
import { reactive, watch } from 'vue'
import { generate, type GenOptions } from '../passwords'
import StrengthMeter from './StrengthMeter.vue'

const emit = defineEmits<{ use: [pw: string] }>()
const o = reactive<GenOptions>({ length: 16, upper: true, digits: true, symbols: true, noAmbiguous: false })
const value = defineModel<string>({ required: true })

const regen = (): void => emit('use', generate(o))
watch(o, regen)

const chips: Array<{ k: keyof Omit<GenOptions, 'length'>; label: string }> = [
  { k: 'upper', label: 'A–Z' },
  { k: 'digits', label: '0–9' },
  { k: 'symbols', label: '!@#' },
  { k: 'noAmbiguous', label: 'Sem ambíguos' }
]
</script>

<template>
  <div class="gen">
    <div class="row">
      <span class="ttl">Gerar senha</span>
      <span class="grow" />
      <StrengthMeter :value="value" class="w-[170px]" />
    </div>
    <div class="row">
      <span class="hx-hint len">{{ o.length }} caracteres</span>
      <USlider v-model="o.length" :min="8" :max="64" class="flex-1" aria-label="Tamanho" />
    </div>
    <div class="row wrap">
      <button v-for="c in chips" :key="c.k" type="button" class="chip" :class="{ on: o[c.k] }" :aria-pressed="o[c.k]" @click="o[c.k] = !o[c.k]">{{ c.label }}</button>
      <span class="grow" />
      <button type="button" class="chip" @click="regen"><UIcon name="i-lucide-refresh-cw" class="size-[14px]" />Outra</button>
    </div>
  </div>
</template>

<style scoped>
.gen {
  border: 1px solid var(--hx-line);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--hx-bg);
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wrap {
  flex-wrap: wrap;
  gap: 6px;
}
.ttl {
  font-weight: 600;
  font-size: 13px;
}
.grow {
  flex-grow: 1;
}
.len {
  width: 96px;
}
.chip {
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--hx-line);
  background: var(--hx-surface);
  font: inherit;
  font-size: 13px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--hx-ink);
  cursor: pointer;
}
.chip.on {
  background: var(--hx-soft);
  border-color: var(--hx-primary);
  color: var(--hx-soft-ink);
  font-weight: 600;
}
</style>
