<script setup lang="ts">
import { reactive } from 'vue'
import type { Task } from '@shared/types'
import { useCopy } from '../copy'
import { fromLocalInput, toLocalInput } from '../format'
import { S, trash, upsertTask } from '../store'
import Sheet from '../components/Sheet.vue'

const props = defineProps<{ id: string }>()
const { info } = useCopy()
const original = S.data!.tasks.find((x) => x.id === props.id)!
const t = reactive<Task>(JSON.parse(JSON.stringify(original)))
const form = reactive({ due: toLocalInput(t.due) })

const repeatItems = [
  { label: 'Não repetir', value: 'none' },
  { label: 'Todo dia', value: 'daily' },
  { label: 'Toda semana', value: 'weekly' },
  { label: 'Todo mês', value: 'monthly' }
]

function save(): void {
  if (!t.title.trim()) return
  const due = fromLocalInput(form.due)
  upsertTask({ ...t, title: t.title.trim(), due, repeat: due ? t.repeat : 'none', snoozedUntil: due === original.due ? t.snoozedUntil : null })
  S.sheet = null
}

function remove(): void {
  trash('tasks', t.id)
  info('Tarefa movida para a lixeira')
  S.sheet = null
}
</script>

<template>
  <Sheet :title="original.title" back @close="S.sheet = null">
    <form class="form" @submit.prevent="save">
      <div class="hx-field">
        <label class="hx-label" for="te-title">Tarefa</label>
        <div class="hx-in"><input id="te-title" v-model="t.title" autofocus /></div>
      </div>
      <div class="two">
        <div class="hx-field">
          <label class="hx-label" for="te-due">Lembrar em</label>
          <div class="hx-in">
            <input id="te-due" v-model="form.due" type="datetime-local" />
            <button v-if="form.due" type="button" class="hx-ib" aria-label="Tirar data" @click="form.due = ''"><UIcon name="i-lucide-x" class="size-4" /></button>
          </div>
          <span class="hx-hint">Sem data, fica como tarefa simples, sem notificação.</span>
        </div>
        <div class="hx-field">
          <span class="hx-label">Repetir</span>
          <USelect v-model="t.repeat" :items="repeatItems" :disabled="!form.due" />
        </div>
      </div>
      <div class="hx-field">
        <label class="hx-label" for="te-notes">Observações</label>
        <div class="hx-in"><textarea id="te-notes" v-model="t.notes" rows="4" /></div>
      </div>
      <label class="ck"><input v-model="t.done" type="checkbox" />Concluída</label>
    </form>
    <template #footer>
      <button class="hx-btn hx-danger" @click="remove"><UIcon name="i-lucide-trash-2" class="size-4" />Excluir</button>
      <span class="grow" />
      <button class="hx-btn hx-ghost" @click="S.sheet = null">Cancelar</button>
      <button class="hx-btn hx-primary" :disabled="!t.title.trim()" @click="save">Salvar</button>
    </template>
  </Sheet>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.grow {
  flex-grow: 1;
}
.ck {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.ck input {
  width: 18px;
  height: 18px;
  accent-color: var(--hx-primary);
}
</style>
