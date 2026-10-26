<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { Task } from '@shared/types'
import { useCopy } from '../copy'
import { fromLocalInput, toLocalInput } from '../format'
import { t } from '../i18n'
import { S, trash, upsertTask } from '../store'
import Sheet from '../components/Sheet.vue'

const props = defineProps<{ id: string }>()
const { info } = useCopy()
const original = S.data!.tasks.find((x) => x.id === props.id)!
const task = reactive<Task>(JSON.parse(JSON.stringify(original)))
const form = reactive({ due: toLocalInput(task.due) })

const repeatItems = computed(() => [
  { label: t('Não repetir'), value: 'none' },
  { label: t('Todo dia'), value: 'daily' },
  { label: t('Toda semana'), value: 'weekly' },
  { label: t('Todo mês'), value: 'monthly' }
])

function save(): void {
  if (!task.title.trim()) return
  const due = fromLocalInput(form.due)
  upsertTask({ ...task, title: task.title.trim(), due, repeat: due ? task.repeat : 'none', snoozedUntil: due === original.due ? task.snoozedUntil : null })
  S.sheet = null
}

function remove(): void {
  trash('tasks', task.id)
  info(t('Tarefa movida para a lixeira'))
  S.sheet = null
}
</script>

<template>
  <Sheet :title="original.title" back @close="S.sheet = null">
    <form class="form" @submit.prevent="save">
      <div class="hx-field">
        <label class="hx-label" for="te-title">{{ t('Tarefa') }}</label>
        <div class="hx-in"><input id="te-title" v-model="task.title" autofocus /></div>
      </div>
      <div class="two">
        <div class="hx-field">
          <label class="hx-label" for="te-due">{{ t('Lembrar em') }}</label>
          <div class="hx-in">
            <input id="te-due" v-model="form.due" type="datetime-local" />
            <button v-if="form.due" type="button" class="hx-ib" :aria-label="t('Tirar data')" @click="form.due = ''"><UIcon name="i-lucide-x" class="size-4" /></button>
          </div>
          <span class="hx-hint">{{ t('Sem data, fica no TO DO, sem notificação.') }}</span>
        </div>
        <div class="hx-field">
          <span class="hx-label">{{ t('Repetir') }}</span>
          <USelect v-model="task.repeat" :items="repeatItems" :disabled="!form.due" />
        </div>
      </div>
      <div class="hx-field">
        <label class="hx-label" for="te-notes">{{ t('Observações') }}</label>
        <div class="hx-in"><textarea id="te-notes" v-model="task.notes" rows="4" /></div>
      </div>
      <label class="ck"><input v-model="task.done" type="checkbox" />{{ t('Concluída') }}</label>
    </form>
    <template #footer>
      <button class="hx-btn hx-danger" @click="remove"><UIcon name="i-lucide-trash-2" class="size-4" />{{ t('Excluir') }}</button>
      <span class="grow" />
      <button class="hx-btn hx-ghost" @click="S.sheet = null">{{ t('Cancelar') }}</button>
      <button class="hx-btn hx-primary" :disabled="!task.title.trim()" @click="save">{{ t('Salvar') }}</button>
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
