<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Note } from '@shared/types'
import { useCopy } from '../copy'
import { NOTE_COLORS } from '../format'
import { t } from '../i18n'
import { parse, toggleLine } from '../markdown'
import { S, purge, trash, upsertNote } from '../store'
import Attachments from '../components/Attachments.vue'
import Sheet from '../components/Sheet.vue'

const props = defineProps<{ id: string }>()
const { info } = useCopy()

const id = props.id
const n = computed(() => S.data!.notes.find((x) => x.id === id)!)
const editing = ref(!n.value?.body)
const blocks = computed(() => parse(n.value?.body ?? ''))

function patch(p: Partial<Note>): void {
  upsertNote({ ...n.value, ...p })
}

function toggle(line: number): void {
  patch({ body: toggleLine(n.value.body, line) })
}

function insert(prefix: string): void {
  const body = n.value.body
  patch({ body: body + (body && !body.endsWith('\n') ? '\n' : '') + prefix })
  editing.value = true
}

function close(): void {
  S.sheet = null
}

function remove(): void {
  trash('notes', id)
  info(t('Nota movida para a lixeira'))
  close()
}

onBeforeUnmount(() => {
  const cur = S.data?.notes.find((x) => x.id === id)
  if (cur && !cur.title.trim() && !cur.body.trim() && !cur.attachments.length) purge('notes', id)
})
</script>

<template>
  <Sheet v-if="n" :title="n.title || t('Nova nota')" back @close="close">
    <template #actions>
      <UTooltip :text="n.pinned ? t('Desafixar') : t('Fixar no topo')">
        <button class="hx-ib" :class="{ on: n.pinned }" :aria-pressed="n.pinned" :aria-label="t('Fixar')" @click="patch({ pinned: !n.pinned })">
          <UIcon :name="n.pinned ? 'i-lucide-pin' : 'i-lucide-pin'" class="size-[18px]" />
        </button>
      </UTooltip>
      <UTooltip :text="editing ? t('Ver como lista') : t('Editar texto')">
        <button class="hx-ib" :aria-label="editing ? t('Ver como lista') : t('Editar texto')" @click="editing = !editing">
          <UIcon :name="editing ? 'i-lucide-list-checks' : 'i-lucide-pencil'" class="size-[18px]" />
        </button>
      </UTooltip>
    </template>

    <input class="title" :value="n.title" :placeholder="t('Título')" :aria-label="t('Título')" autofocus @input="patch({ title: ($event.target as HTMLInputElement).value })" />

    <div class="colors" role="radiogroup" :aria-label="t('Cor da etiqueta')">
      <button
        v-for="c in NOTE_COLORS"
        :key="c.id"
        class="c"
        role="radio"
        :aria-checked="n.color === c.id"
        :aria-label="t(c.label)"
        :style="{ background: c.hex }"
        :class="{ sel: n.color === c.id }"
        @click="patch({ color: c.id })"
      />
      <span class="grow" />
      <button class="hx-btn hx-ghost sm" @click="insert('- [ ] ')"><UIcon name="i-lucide-square-check" class="size-4" />{{ t('Item de checklist') }}</button>
    </div>

    <textarea
      v-if="editing"
      class="text"
      :value="n.body"
      :placeholder="t('Escreva aqui. Dicas: **negrito**, *itálico*, \'# \' para título, \'- \' para lista e \'- [ ] \' para checklist.')"
      :aria-label="t('Texto da nota')"
      @input="patch({ body: ($event.target as HTMLTextAreaElement).value })"
    />
    <div v-else class="read" @dblclick="editing = true">
      <template v-for="(b, i) in blocks" :key="i">
        <h3 v-if="b.kind === 'h'"><span v-for="(s, j) in b.spans" :key="j" :class="{ b: s.bold, i: s.italic }">{{ s.text }}</span></h3>
        <label v-else-if="b.kind === 'check'" class="check" :class="{ done: b.done }">
          <input type="checkbox" :checked="b.done" @change="toggle(b.line)" />
          <span><span v-for="(s, j) in b.spans" :key="j" :class="{ b: s.bold, i: s.italic }">{{ s.text }}</span></span>
        </label>
        <div v-else-if="b.kind === 'bullet'" class="bullet"><span v-for="(s, j) in b.spans" :key="j" :class="{ b: s.bold, i: s.italic }">{{ s.text }}</span></div>
        <p v-else-if="b.kind === 'p'"><span v-for="(s, j) in b.spans" :key="j" :class="{ b: s.bold, i: s.italic }">{{ s.text }}</span></p>
        <div v-else class="gap" />
      </template>
      <p v-if="!n.body" class="hx-hint">{{ t('Nota vazia. Clique no lápis para escrever.') }}</p>
    </div>

    <Attachments :model-value="n.attachments" @update:model-value="(v) => patch({ attachments: v })" />

    <template #footer>
      <button class="hx-btn hx-danger" @click="remove"><UIcon name="i-lucide-trash-2" class="size-4" />{{ t('Excluir') }}</button>
      <span class="grow" />
      <span class="hx-hint">{{ t('Salva sozinha') }}</span>
      <button class="hx-btn hx-primary" @click="close">{{ t('Pronto') }}</button>
    </template>
  </Sheet>
</template>

<style scoped>
.title {
  border: 0;
  background: none;
  font: inherit;
  font-size: 20px;
  font-weight: 700;
  color: var(--hx-ink);
  outline: 0;
  padding: 0;
}
.title::placeholder {
  color: var(--hx-muted);
}
.colors {
  display: flex;
  align-items: center;
  gap: 8px;
}
.c {
  width: 20px;
  height: 20px;
  border-radius: 10px;
  border: 0;
  cursor: pointer;
  padding: 0;
}
.c.sel {
  box-shadow: 0 0 0 2px var(--hx-surface), 0 0 0 4px var(--hx-ink);
}
.grow {
  flex-grow: 1;
}
.sm {
  height: 30px;
  font-size: 13px;
}
.on {
  color: var(--hx-primary);
}
.text {
  flex-grow: 1;
  min-height: 260px;
  border: 1px solid var(--hx-line);
  border-radius: 12px;
  background: var(--hx-surface);
  font: inherit;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--hx-ink);
  padding: 12px 14px;
  resize: none;
  outline: 0;
}
.text:focus {
  border-color: var(--hx-primary);
  box-shadow: 0 0 0 3px var(--hx-soft);
}
.read {
  flex-grow: 1;
  min-height: 200px;
  font-size: 14.5px;
  line-height: 1.6;
  user-select: text;
}
.read h3 {
  font-size: 16px;
  margin: 6px 0 2px;
}
.read p {
  margin: 0;
}
.bullet {
  padding-left: 18px;
  position: relative;
}
.bullet::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 0.7em;
  width: 5px;
  height: 5px;
  border-radius: 3px;
  background: var(--hx-muted);
}
.check {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 2px 0;
  cursor: pointer;
}
.check input {
  width: 18px;
  height: 18px;
  margin-top: 3px;
  accent-color: var(--hx-primary);
  flex-shrink: 0;
}
.check.done > span {
  text-decoration: line-through;
  color: var(--hx-muted);
}
.gap {
  height: 10px;
}
.b {
  font-weight: 700;
}
.i {
  font-style: italic;
}
</style>
