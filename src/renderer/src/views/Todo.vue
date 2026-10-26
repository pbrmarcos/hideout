<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Task } from '@shared/types'
import { dueLabel, parseQuick } from '../format'
import { t } from '../i18n'
import { useCopy } from '../copy'
import { S, live, placeTask, quickTask, todoList, toggleTask, trash } from '../store'

const { info } = useCopy()
const text = ref('')
const showDone = ref(false)

const parsed = computed(() => parseQuick(text.value))
const items = computed(() => todoList())
const done = computed(() =>
  live(S.data!.tasks)
    .filter((x) => x.done && !x.due)
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
)

function add(): void {
  const { title, due } = parsed.value
  if (!title) return
  quickTask(title, due)
  text.value = ''
  // A date turns it into a reminder, which lives in the Agenda.
  if (due) info(t('Foi para a Agenda'), dueLabel(due))
}

function clearDone(): void {
  for (const x of done.value) trash('tasks', x.id)
}

// --- drag to reorder ---------------------------------------------------------------
const dragId = ref<string | null>(null)
const over = ref<string | null>(null)

function onDragStart(x: Task, e: DragEvent): void {
  dragId.value = x.id
  e.dataTransfer?.setData('text/plain', x.title)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragOver(target: string, e: DragEvent): void {
  if (!dragId.value) return
  e.preventDefault()
  over.value = target
}
function onDrop(beforeId: string | null): void {
  if (dragId.value) placeTask(dragId.value, beforeId)
  endDrag()
}
function endDrag(): void {
  dragId.value = null
  over.value = null
}
</script>

<template>
  <form class="add" @submit.prevent="add">
    <UIcon name="i-lucide-plus" class="size-[18px] text-(--hx-primary) shrink-0" />
    <input v-model="text" :placeholder="t('Novo item do TO DO')" :aria-label="t('Novo item do TO DO')" />
    <span v-if="parsed.due && text" class="chip" :title="t('Com data, vai para a Agenda')">
      <UIcon name="i-lucide-bell" class="size-3" />{{ dueLabel(parsed.due) }}
    </span>
  </form>

  <div class="list" @dragend="endDrag">
    <div v-if="!items.length && !done.length" class="empty">
      <UIcon name="i-lucide-list-todo" class="size-9 icon" />
      <h2>{{ t('Nada pendente') }}</h2>
      <p>{{ t('Escreva acima o que precisa fazer. Arraste os itens para mudar a ordem.') }}</p>
    </div>
    <p v-else-if="!items.length" class="all-done"><UIcon name="i-lucide-party-popper" class="size-4" />{{ t('Tudo feito!') }}</p>

    <div
      v-for="x in items"
      :key="x.id"
      class="it"
      :class="{ before: over === x.id && dragId !== x.id, dragging: dragId === x.id }"
      draggable="true"
      @dragstart="onDragStart(x, $event)"
      @dragover="onDragOver(x.id, $event)"
      @drop.prevent="onDrop(x.id)"
      @click="S.sheet = { kind: 'task', id: x.id }"
    >
      <UIcon name="i-lucide-grip-vertical" class="size-4 grip" aria-hidden="true" />
      <button class="ck" :aria-label="t('Concluir {title}', { title: x.title })" aria-pressed="false" @click.stop="toggleTask(x)">
        <UIcon name="i-lucide-check" class="size-[14px]" />
      </button>
      <div class="n">{{ x.title }}</div>
      <UIcon v-if="x.notes" name="i-lucide-text" class="size-[14px] muted" :aria-label="t('Tem observação')" />
    </div>
    <div v-if="items.length" class="tail" :class="{ before: over === 'end' }" @dragover="onDragOver('end', $event)" @drop.prevent="onDrop(null)" />

    <section v-if="done.length">
      <div class="gh">
        <button class="toggle" :aria-expanded="showDone" @click="showDone = !showDone">
          <UIcon name="i-lucide-chevron-down" class="size-[14px] chev" :class="{ closed: !showDone }" />{{ t('Concluídas ({n})', { n: done.length }) }}
        </button>
        <button v-if="showDone" class="clear" @click="clearDone">{{ t('Limpar concluídas') }}</button>
      </div>
      <template v-if="showDone">
        <div v-for="x in done" :key="x.id" class="it" @click="S.sheet = { kind: 'task', id: x.id }">
          <span class="grip-space" />
          <button class="ck done" :aria-label="t('Reabrir {title}', { title: x.title })" aria-pressed="true" @click.stop="toggleTask(x)"><UIcon name="i-lucide-check" class="size-[14px]" /></button>
          <div class="n struck">{{ x.title }}</div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.add {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  box-sizing: border-box;
  margin: 14px 14px 6px;
  border: 1px solid var(--hx-line);
  border-radius: 11px;
  background: var(--hx-surface);
  padding: 0 8px 0 12px;
}
.add:focus-within {
  border-color: var(--hx-primary);
  box-shadow: 0 0 0 3px var(--hx-soft);
}
.add input {
  border: 0;
  outline: 0;
  font: inherit;
  flex-grow: 1;
  min-width: 0;
  background: transparent;
  color: var(--hx-ink);
  height: 40px;
}
.chip {
  font-size: 12px;
  font-weight: 600;
  color: var(--hx-soft-ink);
  background: var(--hx-soft);
  border-radius: 6px;
  padding: 3px 7px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.list {
  flex-grow: 1;
  overflow-y: auto;
  padding-bottom: 12px;
}
.it {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px 8px 6px;
  min-height: 44px;
  box-sizing: border-box;
  cursor: pointer;
}
.it:hover {
  background: var(--hx-bg);
}
.it.before,
.tail.before {
  box-shadow: inset 0 3px 0 var(--hx-primary);
}
.it.dragging {
  opacity: 0.45;
}
.tail {
  height: 24px;
}
.grip {
  color: var(--hx-muted);
  opacity: 0;
  cursor: grab;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.it:hover .grip {
  opacity: 0.7;
}
.grip-space {
  width: 16px;
  flex-shrink: 0;
}
.ck {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  border: 2px solid var(--hx-muted);
  background: var(--hx-surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  color: transparent;
  transition: background-color 0.15s, color 0.15s;
}
.ck:hover {
  color: var(--hx-muted);
}
.ck.done {
  background: var(--hx-primary);
  border-color: var(--hx-primary);
  color: var(--hx-on-primary);
}
.n {
  flex-grow: 1;
  min-width: 0;
  font-size: 14.5px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.struck {
  text-decoration: line-through;
  color: var(--hx-muted);
}
.muted {
  color: var(--hx-muted);
  flex-shrink: 0;
}
.gh {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 4px;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  font-size: 13px;
  color: var(--hx-ink);
  opacity: 0.85;
  cursor: pointer;
  padding: 0;
}
.clear {
  border: 0;
  background: none;
  font: inherit;
  font-size: 12.5px;
  color: var(--hx-muted);
  cursor: pointer;
}
.clear:hover {
  color: var(--hx-danger);
}
.chev {
  transition: transform 0.15s;
}
.chev.closed {
  transform: rotate(-90deg);
}
.all-done {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px;
  color: var(--hx-soft-ink);
  font-weight: 600;
  font-size: 13.5px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 48px 32px 24px;
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
