<script setup lang="ts">
import { computed } from 'vue'
import { strength } from '../passwords'

const props = defineProps<{ value: string }>()
const s = computed(() => strength(props.value))
</script>

<template>
  <div class="row" :aria-label="`Força: ${s.label || 'vazia'}`">
    <div class="meter">
      <span v-for="i in 4" :key="i" :class="{ ok: i <= s.score, weak: s.score === 1 && i === 1 }" />
    </div>
    <span class="lbl" :class="{ weakTxt: s.score === 1 }">{{ s.label }}</span>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.meter {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  flex-grow: 1;
}
.meter span {
  height: 5px;
  border-radius: 3px;
  background: var(--hx-line);
  transition: background-color 0.2s;
}
.meter .ok {
  background: var(--hx-primary);
}
.meter .weak {
  background: var(--hx-danger);
}
.lbl {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--hx-soft-ink);
  min-width: 76px;
  text-align: right;
}
.weakTxt {
  color: var(--hx-danger);
}
</style>
