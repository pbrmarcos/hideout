<script setup lang="ts">
import { computed } from 'vue'
import { TRASH_DAYS } from '@shared/model'
import { t } from '../i18n'
import { S, purge, restore } from '../store'
import Sheet from '../components/Sheet.vue'

type Kind = 'accesses' | 'notes' | 'tasks'
const DAY = 86_400_000

const items = computed(() => {
  const d = S.data!
  const rows: Array<{ kind: Kind; id: string; title: string; icon: string; deletedAt: string }> = [
    ...d.accesses.filter((x) => x.deletedAt).map((x) => ({ kind: 'accesses' as Kind, id: x.id, title: x.title || t('Sem nome'), icon: 'i-lucide-key-round', deletedAt: x.deletedAt! })),
    ...d.notes.filter((x) => x.deletedAt).map((x) => ({ kind: 'notes' as Kind, id: x.id, title: x.title || t('Nota sem título'), icon: 'i-lucide-sticky-note', deletedAt: x.deletedAt! })),
    ...d.tasks.filter((x) => x.deletedAt).map((x) => ({ kind: 'tasks' as Kind, id: x.id, title: x.title, icon: 'i-lucide-calendar-check', deletedAt: x.deletedAt! }))
  ]
  return rows.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
})

const daysLeft = (iso: string): number => Math.max(0, Math.ceil(TRASH_DAYS - (Date.now() - Date.parse(iso)) / DAY))
</script>

<template>
  <Sheet :title="t('Lixeira')" back @close="S.sheet = { kind: 'settings' }">
    <p class="hx-hint">{{ t('Itens excluídos ficam aqui por {n} dias e depois somem de vez, em todos os computadores.', { n: TRASH_DAYS }) }}</p>
    <p v-if="!items.length" class="empty">{{ t('A lixeira está vazia.') }}</p>
    <div v-for="i in items" :key="i.id" class="row">
      <UIcon :name="i.icon" class="size-4 shrink-0" />
      <span class="t">{{ i.title }}<span class="hx-hint">{{ daysLeft(i.deletedAt) === 1 ? t('Some em 1 dia') : t('Some em {n} dias', { n: daysLeft(i.deletedAt) }) }}</span></span>
      <button class="hx-btn hx-soft sm" @click="restore(i.kind, i.id)">{{ t('Restaurar') }}</button>
      <button class="hx-btn hx-danger sm" @click="purge(i.kind, i.id)">{{ t('Apagar') }}</button>
    </div>
  </Sheet>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  border-top: 1px solid var(--hx-line);
}
.t {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  font-weight: 600;
}
.sm {
  height: 32px;
  font-size: 13px;
  padding: 0 10px;
}
.empty {
  color: var(--hx-muted);
  text-align: center;
  padding: 40px 0;
}
</style>
