<script setup lang="ts">
import { TEMPLATES } from '@shared/model'
import type { ItemType } from '@shared/types'
import { S, openNewNote } from '../store'
import Sheet from '../components/Sheet.vue'

function pick(type: ItemType): void {
  S.sheet = { kind: 'access', id: null, type }
}
</script>

<template>
  <Sheet title="O que você quer guardar?" @close="S.sheet = null">
    <div class="grid">
      <button v-for="t in TEMPLATES" :key="t.type" class="opt" @click="pick(t.type)">
        <span class="oi"><UIcon :name="t.icon" class="size-[19px]" /></span>
        <span class="ot"><b>{{ t.label }}</b><span>{{ t.hint }}</span></span>
      </button>
      <button class="opt" @click="openNewNote">
        <span class="oi"><UIcon name="i-lucide-sticky-note" class="size-[19px]" /></span>
        <span class="ot"><b>Nota</b><span>Texto livre e checklist</span></span>
      </button>
      <button class="opt" @click="(S.tab = 'agenda'), (S.sheet = null)">
        <span class="oi"><UIcon name="i-lucide-calendar-check" class="size-[19px]" /></span>
        <span class="ot"><b>Tarefa</b><span>Com ou sem lembrete</span></span>
      </button>
    </div>
    <p class="hx-hint">Cada modelo já vem com os campos certos. Você pode adicionar outros campos depois.</p>
  </Sheet>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}
.opt {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 0;
  background: var(--hx-bg);
  font: inherit;
  text-align: left;
  cursor: pointer;
  color: var(--hx-ink);
  transition: background-color 0.15s, box-shadow 0.15s;
}
.opt:hover {
  background: var(--hx-soft);
  box-shadow: inset 0 0 0 2px var(--hx-primary);
}
.oi {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--hx-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hx-primary);
  flex-shrink: 0;
}
.ot {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.ot b {
  font-size: 14px;
  font-weight: 600;
}
.ot span {
  font-size: 12px;
  color: var(--hx-muted);
}
</style>
