<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { S, live, openNewNote, type Tab } from '../store'
import Accesses from './Accesses.vue'
import AccessEdit from './AccessEdit.vue'
import Agenda from './Agenda.vue'
import AutoTypePicker from './AutoTypePicker.vue'
import NoteEdit from './NoteEdit.vue'
import Notes from './Notes.vue'
import SearchPalette from './SearchPalette.vue'
import Settings from './Settings.vue'
import TaskEdit from './TaskEdit.vue'
import Templates from './Templates.vue'
import Trash from './Trash.vue'

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'accesses', label: 'Acessos', icon: 'i-lucide-key-round' },
  { id: 'notes', label: 'Notas', icon: 'i-lucide-sticky-note' },
  { id: 'agenda', label: 'Agenda', icon: 'i-lucide-calendar-check' }
]

const todayCount = computed(() => {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return live(S.data?.tasks ?? []).filter((t) => !t.done && t.due && Date.parse(t.due) <= end.getTime()).length
})

function onKey(e: KeyboardEvent): void {
  if (e.ctrlKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    S.search = true
  } else if (e.ctrlKey && ['1', '2', '3'].includes(e.key)) {
    S.tab = tabs[Number(e.key) - 1].id
    S.sheet = null
  } else if (e.ctrlKey && e.key.toLowerCase() === 'n' && !S.sheet) {
    e.preventDefault()
    if (S.tab === 'accesses') S.sheet = { kind: 'templates' }
    else if (S.tab === 'notes') openNewNote()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="shell">
    <div class="top">
      <button class="search" @click="S.search = true">
        <UIcon name="i-lucide-search" class="size-[17px]" />
        <span>Buscar em acessos, notas e agenda</span>
        <UKbd value="Ctrl K" class="ml-auto" />
      </button>
      <nav class="tabs" role="tablist" aria-label="Seções">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab"
          role="tab"
          :class="{ on: S.tab === t.id }"
          :aria-selected="S.tab === t.id"
          @click="(S.tab = t.id), (S.sheet = null)"
        >
          <UIcon :name="t.icon" class="size-4" />
          {{ t.label }}
          <span v-if="t.id === 'agenda' && todayCount" class="badge" :aria-label="`${todayCount} para hoje`">{{ todayCount }}</span>
        </button>
      </nav>
    </div>

    <main class="panel">
      <Accesses v-if="S.tab === 'accesses'" />
      <Notes v-else-if="S.tab === 'notes'" />
      <Agenda v-else />

      <Transition name="hx-sheet">
        <AccessEdit v-if="S.sheet?.kind === 'access'" :key="S.sheet.id ?? 'new'" :id="S.sheet.id" :type="S.sheet.type" :category="S.sheet.category" />
        <NoteEdit v-else-if="S.sheet?.kind === 'note'" :key="S.sheet.id" :id="S.sheet.id" />
        <TaskEdit v-else-if="S.sheet?.kind === 'task'" :key="S.sheet.id" :id="S.sheet.id" />
        <Templates v-else-if="S.sheet?.kind === 'templates'" />
        <Settings v-else-if="S.sheet?.kind === 'settings'" />
        <Trash v-else-if="S.sheet?.kind === 'trash'" />
      </Transition>
    </main>

    <SearchPalette />
    <AutoTypePicker />
  </div>
</template>

<style scoped>
.shell {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.top {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 14px 14px;
}
.search {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--hx-surface);
  border: 1px solid var(--hx-line);
  border-radius: 10px;
  padding: 0 10px 0 12px;
  color: var(--hx-muted);
  font: inherit;
  cursor: text;
  text-align: left;
}
.search:hover {
  border-color: var(--hx-muted);
}
.tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  background: var(--hx-tab);
  border-radius: 11px;
  padding: 3px;
}
.tab {
  height: 36px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  font: inherit;
  font-weight: 500;
  color: var(--hx-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.tab:hover {
  color: var(--hx-ink);
}
.tab.on {
  background: var(--hx-surface);
  color: var(--hx-ink);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.14);
}
.badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  box-sizing: border-box;
  border-radius: 9px;
  background: var(--hx-primary);
  color: var(--hx-on-primary);
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.panel {
  position: relative;
  flex-grow: 1;
  min-height: 0;
  background: var(--hx-surface);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -1px 0 var(--hx-line);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
