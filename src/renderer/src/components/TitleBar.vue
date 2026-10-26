<script setup lang="ts">
import type { WindowMode, WindowState } from '@shared/types'
import { api } from '../api'
import { S, lockNow } from '../store'
import Logo from './Logo.vue'

defineProps<{ unlocked: boolean }>()

async function mode(m: WindowMode): Promise<void> {
  S.window = await api<WindowState>('win:mode', m)
}
async function top(): Promise<void> {
  S.window = await api<WindowState>('win:top')
}

const modes: Array<{ m: WindowMode; label: string; icon: string }> = [
  { m: 'left', label: 'Encaixar à esquerda', icon: 'i-lucide-panel-left' },
  { m: 'float', label: 'Flutuar', icon: 'i-lucide-picture-in-picture-2' },
  { m: 'right', label: 'Encaixar à direita', icon: 'i-lucide-panel-right' }
]
</script>

<template>
  <header class="drag bar">
    <div class="brand">
      <Logo />
      <span>Hideout</span>
      <span v-if="S.saving" class="saving" aria-live="polite">salvando…</span>
    </div>
    <div class="no-drag tools">
      <template v-if="unlocked">
        <UTooltip text="Trancar agora">
          <button class="hx-ib" aria-label="Trancar agora" @click="lockNow">
            <UIcon name="i-lucide-lock" class="size-[17px]" />
          </button>
        </UTooltip>
        <UTooltip text="Configurações">
          <button class="hx-ib" aria-label="Configurações" @click="S.sheet = { kind: 'settings' }">
            <UIcon name="i-lucide-sliders-horizontal" class="size-[17px]" />
          </button>
        </UTooltip>
      </template>
      <div class="seg" role="group" aria-label="Posição da janela">
        <UTooltip v-for="x in modes" :key="x.m" :text="x.label">
          <button class="hx-ib" :class="{ on: S.window.mode === x.m }" :aria-label="x.label" :aria-pressed="S.window.mode === x.m" @click="mode(x.m)">
            <UIcon :name="x.icon" class="size-[16px]" />
          </button>
        </UTooltip>
      </div>
      <UTooltip :text="S.window.alwaysOnTop ? 'Deixar de ficar no topo' : 'Manter sempre no topo'">
        <button class="hx-ib" :class="{ pinned: S.window.alwaysOnTop }" aria-label="Manter sempre no topo" :aria-pressed="S.window.alwaysOnTop" @click="top">
          <UIcon :name="S.window.alwaysOnTop ? 'i-lucide-pin' : 'i-lucide-pin-off'" class="size-[17px]" />
        </button>
      </UTooltip>
      <button class="hx-ib" aria-label="Minimizar" @click="api('win:minimize')"><UIcon name="i-lucide-minus" class="size-[17px]" /></button>
      <UTooltip text="Fechar para a bandeja">
        <button class="hx-ib close" aria-label="Fechar para a bandeja" @click="api('win:hide')"><UIcon name="i-lucide-x" class="size-[17px]" /></button>
      </UTooltip>
    </div>
  </header>
</template>

<style scoped>
.bar {
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px 0 14px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
  flex-grow: 1;
  min-width: 0;
}
.saving {
  font-weight: 500;
  font-size: 12px;
  color: var(--hx-muted);
}
.tools {
  display: flex;
  align-items: center;
  gap: 2px;
}
.seg {
  display: flex;
  background: var(--hx-tab);
  border-radius: 9px;
  padding: 2px;
  gap: 2px;
  margin: 0 4px;
}
.seg .hx-ib {
  width: 30px;
  height: 28px;
  border-radius: 7px;
}
.seg .hx-ib.on {
  background: var(--hx-surface);
  color: var(--hx-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.14);
}
.pinned {
  color: var(--hx-primary);
}
.close:hover {
  background: var(--hx-danger-soft);
  color: var(--hx-danger);
}
</style>
