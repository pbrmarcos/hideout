<script setup lang="ts">
import { computed, ref } from 'vue'
import { newNote } from '@shared/model'
import { S, live, openNewNote, upsertNote } from '../store'
import { preview, progress } from '../markdown'
import { NOTE_COLORS, relDate } from '../format'

const quick = ref('')

const notes = computed(() => live(S.data!.notes).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
const pinned = computed(() => notes.value.filter((n) => n.pinned))
const recent = computed(() => notes.value.filter((n) => !n.pinned))

function addQuick(): void {
  const text = quick.value.trim()
  if (!text) return
  upsertNote(newNote(text.slice(0, 80), text.length > 80 ? text : ''))
  quick.value = ''
}

const color = (c: string): string => NOTE_COLORS.find((x) => x.id === c)?.hex ?? NOTE_COLORS[0].hex
</script>

<template>
  <div class="list">
    <div v-if="!notes.length" class="empty">
      <UIcon name="i-lucide-sticky-note" class="size-9 icon" />
      <h2>Nenhuma nota ainda</h2>
      <p>Escreva uma nota rápida lá embaixo e aperte Enter. Use "- [ ]" no começo da linha para criar um checklist.</p>
    </div>
    <template v-for="(group, gi) in [pinned, recent]" :key="gi">
      <div v-if="group.length" class="gh">
        <UIcon v-if="gi === 0" name="i-lucide-pin" class="size-[14px]" />{{ gi === 0 ? 'Fixadas' : pinned.length ? 'Recentes' : 'Todas' }}
      </div>
      <button v-for="n in group" :key="n.id" class="note" @click="S.sheet = { kind: 'note', id: n.id }">
        <span class="cd" :style="{ background: color(n.color) }" aria-hidden="true" />
        <span class="body">
          <span class="nt">{{ n.title || 'Sem título' }}</span>
          <span v-if="n.body" class="np">{{ preview(n.body) }}</span>
          <span class="meta">
            <span v-if="progress(n.body).total" class="prog">
              <span class="bar"><i :style="{ width: `${(progress(n.body).done / progress(n.body).total) * 100}%` }" /></span>
              {{ progress(n.body).done }} de {{ progress(n.body).total }} feitos
            </span>
            <span v-if="n.attachments.length"><UIcon name="i-lucide-paperclip" class="size-3 align-[-1px]" /> {{ n.attachments.length }}</span>
            <span>{{ relDate(n.updatedAt) }}</span>
          </span>
        </span>
      </button>
    </template>
  </div>
  <form class="foot" @submit.prevent="addQuick">
    <div class="hx-in quick"><input v-model="quick" placeholder="Escreva uma nota rápida e pressione Enter" aria-label="Nota rápida" /></div>
    <button type="button" class="hx-btn hx-primary" @click="openNewNote"><UIcon name="i-lucide-plus" class="size-4" />Nova nota</button>
  </form>
</template>

<style scoped>
.list {
  flex-grow: 1;
  overflow-y: auto;
  padding-bottom: 8px;
}
.gh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 14px 6px;
  font-weight: 600;
  font-size: 13px;
  opacity: 0.85;
}
.note {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border: 0;
  border-top: 1px solid var(--hx-line);
  background: none;
  width: 100%;
  text-align: left;
  font: inherit;
  color: var(--hx-ink);
  cursor: pointer;
}
.note:hover {
  background: var(--hx-bg);
}
.cd {
  width: 10px;
  height: 10px;
  border-radius: 5px;
  margin-top: 5px;
  flex-shrink: 0;
}
.body {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.nt {
  font-weight: 600;
  font-size: 14.5px;
}
.np {
  font-size: 13px;
  color: var(--hx-muted);
  line-height: 1.45;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--hx-muted);
  margin-top: 6px;
}
.prog {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.bar {
  width: 54px;
  height: 4px;
  border-radius: 2px;
  background: var(--hx-line);
  position: relative;
  overflow: hidden;
}
.bar i {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--hx-primary);
}
.foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 14px;
  border-top: 1px solid var(--hx-line);
}
.quick {
  flex-grow: 1;
  border-style: dashed;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 56px 32px 24px;
}
.empty .icon {
  color: var(--hx-primary);
}
.empty h2 {
  margin: 6px 0 0;
  font-size: 18px;
}
.empty p {
  margin: 0;
  color: var(--hx-muted);
  line-height: 1.5;
  max-width: 340px;
}
</style>
