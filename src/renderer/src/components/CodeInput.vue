<script setup lang="ts">
import { ref } from 'vue'

const code = defineModel<string>({ required: true })
const emit = defineEmits<{ complete: [code: string] }>()
defineProps<{ label: string; autofocus?: boolean }>()
const input = ref<HTMLInputElement | null>(null)

function onInput(e: Event): void {
  const v = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6)
  code.value = v
  ;(e.target as HTMLInputElement).value = v
  if (v.length === 6) emit('complete', v)
}

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <label class="wrap" @click="input?.focus()">
    <span class="sr">{{ label }}</span>
    <input
      ref="input"
      class="hidden-input"
      :value="code"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="6"
      :autofocus="autofocus"
      :aria-label="label"
      @input="onInput"
    />
    <span class="digits" aria-hidden="true">
      <span v-for="i in 6" :key="i" :class="{ cur: i === code.length + 1 }">{{ code[i - 1] ?? '' }}</span>
    </span>
  </label>
</template>

<style scoped>
.wrap {
  position: relative;
  display: block;
  cursor: text;
}
.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.hidden-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
}
.digits {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}
.digits span {
  height: 52px;
  border-radius: 11px;
  border: 1px solid var(--hx-line);
  background: var(--hx-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 600;
}
.wrap:focus-within .digits span.cur {
  border-color: var(--hx-primary);
  box-shadow: 0 0 0 3px var(--hx-soft);
}
</style>
