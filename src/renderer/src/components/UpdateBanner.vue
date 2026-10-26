<script setup lang="ts">
import { computed } from 'vue'
import { api } from '../api'
import { t } from '../i18n'
import { S, installUpdate } from '../store'

const show = computed(() => (S.update.status === 'ready' || S.update.status === 'manual') && S.updateDismissed !== S.update.version)
</script>

<template>
  <div v-if="show" class="upd" role="status">
    <UIcon name="i-lucide-sparkles" class="size-[18px] shrink-0" />
    <span class="txt">
      <b>{{ t('Hideout {v} chegou', { v: S.update.version ?? '' }) }}</b>
      <span>{{ S.update.status === 'ready' ? t('Já foi baixado. Reinicie para instalar.') : t('Baixe a versão nova no GitHub.') }}</span>
    </span>
    <button v-if="S.update.status === 'ready'" class="go" @click="installUpdate">{{ t('Reiniciar') }}</button>
    <button v-else class="go" @click="api('update:page')">{{ t('Baixar') }}</button>
    <button class="hx-ib" :aria-label="t('Depois')" @click="S.updateDismissed = S.update.version"><UIcon name="i-lucide-x" class="size-4" /></button>
  </div>
</template>

<style scoped>
.upd {
  margin: 0 14px 10px;
  border-radius: 12px;
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
  padding: 8px 6px 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.txt {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  font-size: 12.5px;
  line-height: 1.35;
}
.txt b {
  font-size: 13.5px;
  color: var(--hx-ink);
}
.go {
  height: 32px;
  border: 0;
  border-radius: 8px;
  padding: 0 12px;
  background: var(--hx-primary);
  color: var(--hx-on-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
</style>
