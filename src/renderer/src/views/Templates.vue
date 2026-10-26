<script setup lang="ts">
import { TEMPLATES } from '@shared/model'
import type { ItemType } from '@shared/types'
import { t } from '../i18n'
import { S, openNewNote } from '../store'
import Sheet from '../components/Sheet.vue'

function pick(type: ItemType): void {
  S.sheet = { kind: 'access', id: null, type }
}
</script>

<template>
  <Sheet :title="t('O que você quer guardar?')" @close="S.sheet = null">
    <div class="grid">
      <button v-for="tpl in TEMPLATES" :key="tpl.type" class="opt" @click="pick(tpl.type)">
        <span class="oi"><UIcon :name="tpl.icon" class="size-[19px]" /></span>
        <span class="ot"><b>{{ t(tpl.label) }}</b><span>{{ t(tpl.hint) }}</span></span>
      </button>
      <button class="opt" @click="openNewNote">
        <span class="oi"><UIcon name="i-lucide-sticky-note" class="size-[19px]" /></span>
        <span class="ot"><b>{{ t('Nota') }}</b><span>{{ t('Texto livre e checklist') }}</span></span>
      </button>
      <button class="opt" @click="(S.tab = 'todo'), (S.sheet = null)">
        <span class="oi"><UIcon name="i-lucide-calendar-check" class="size-[19px]" /></span>
        <span class="ot"><b>{{ t('Tarefa') }}</b><span>{{ t('Com ou sem lembrete') }}</span></span>
      </button>
    </div>
    <p class="hx-hint">{{ t('Cada modelo já vem com os campos certos. Você pode adicionar outros campos depois.') }}</p>
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
