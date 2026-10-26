<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Repeat, Task } from '@shared/types'
import { REPEAT_LABEL, dueLabel, fromLocalInput, parseQuick, time, toLocalInput } from '../format'
import { t } from '../i18n'
import { useCopy } from '../copy'
import { S, live, quickTask, snooze, toggleTask, upsertTask } from '../store'
import { newTask } from '@shared/model'

const { info } = useCopy()

const text = ref('')
const manualDue = ref('')
const manualRepeat = ref<Repeat>('none')
const showDone = ref(false)
const nowTick = ref(Date.now())
const timer = setInterval(() => (nowTick.value = Date.now()), 30_000)
onBeforeUnmount(() => clearInterval(timer))

const parsed = computed(() => parseQuick(text.value))
const due = computed(() => fromLocalInput(manualDue.value) ?? parsed.value.due)

function add(): void {
  const title = manualDue.value ? text.value.trim() : parsed.value.title
  if (!title) return
  if (due.value) upsertTask({ ...newTask(title, due.value), repeat: manualRepeat.value })
  else {
    quickTask(title, null)
    info(t('Sem data, foi para o TO DO'))
  }
  text.value = ''
  manualDue.value = ''
  manualRepeat.value = 'none'
}

const when = (x: Task): number => Date.parse(x.snoozedUntil && x.due && x.snoozedUntil > x.due ? x.snoozedUntil : x.due!)

const groups = computed(() => {
  const n = nowTick.value
  const d0 = new Date(n)
  d0.setHours(0, 0, 0, 0)
  const today = d0.getTime(), tomorrow = today + 86_400_000, after = tomorrow + 86_400_000
  const open = live(S.data!.tasks).filter((x) => !x.done)
  const dated = open.filter((x) => x.due).sort((a, b) => when(a) - when(b))
  return [
    { id: 'late', name: t('Atrasados'), late: true, items: dated.filter((x) => when(x) < today) },
    { id: 'today', name: t('Hoje'), late: false, items: dated.filter((x) => when(x) >= today && when(x) < tomorrow) },
    { id: 'tomorrow', name: t('Amanhã'), late: false, items: dated.filter((x) => when(x) >= tomorrow && when(x) < after) },
    { id: 'next', name: t('Próximos'), late: false, items: dated.filter((x) => when(x) >= after) }
  ].filter((g) => g.items.length)
})
const done = computed(() => live(S.data!.tasks).filter((x) => x.done && x.due).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')).slice(0, 30))
const isPast = (x: Task): boolean => !!x.due && when(x) < nowTick.value

const fired = computed(() => S.fired.map((f) => S.data!.tasks.find((x) => x.id === f.id)).filter((x): x is Task => !!x && !x.done))

const repeatItems = computed(() => [
  { label: t('Não repetir'), value: 'none' },
  { label: t('Todo dia'), value: 'daily' },
  { label: t('Toda semana'), value: 'weekly' },
  { label: t('Todo mês'), value: 'monthly' }
])
</script>

<template>
  <form class="add" @submit.prevent="add">
    <UIcon name="i-lucide-plus" class="size-[18px] text-(--hx-primary) shrink-0" />
    <input v-model="text" :placeholder="t('Nova tarefa. Ex.: pagar boleto amanhã 9h')" :aria-label="t('Nova tarefa')" />
    <span v-if="due && text" class="chip" :title="manualDue ? t('Data escolhida') : t('Data entendida do texto')">
      <UIcon name="i-lucide-bell" class="size-3" />{{ dueLabel(due) }}
    </span>
    <UPopover :content="{ align: 'end' }">
      <button type="button" class="when" :aria-label="t('Escolher data do lembrete')"><UIcon name="i-lucide-bell" class="size-[14px]" />{{ t('Lembrar') }}</button>
      <template #content>
        <div class="pop">
          <label class="hx-label" for="ag-due">{{ t('Quando') }}</label>
          <div class="hx-in"><input id="ag-due" v-model="manualDue" type="datetime-local" :min="toLocalInput(new Date().toISOString())" /></div>
          <label class="hx-label">{{ t('Repetir') }}</label>
          <USelect v-model="manualRepeat" :items="repeatItems" />
          <p class="hx-hint">{{ t('Ou escreva no texto: "hoje 14h", "amanhã 9h", "sexta 10:30", "25/12 8h".') }}</p>
        </div>
      </template>
    </UPopover>
  </form>

  <div v-for="x in fired" :key="'f' + x.id" class="alert" role="status">
    <UIcon name="i-lucide-bell-ring" class="size-[18px] shrink-0" />
    <div class="atx"><b>{{ x.title }}</b><span>{{ x.due ? t('Lembrete de {time}', { time: time(x.snoozedUntil && x.snoozedUntil > x.due ? x.snoozedUntil : x.due) }) : t('Lembrete de agora') }}</span></div>
    <button class="sbtn light" @click="snooze(x.id)">{{ t('Adiar 10 min') }}</button>
    <button class="sbtn dark" @click="toggleTask(x)">{{ t('Concluir') }}</button>
  </div>

  <div class="list">
    <div v-if="!groups.length && !done.length" class="empty">
      <UIcon name="i-lucide-calendar-check" class="size-9 icon" />
      <h2>{{ t('Agenda livre') }}</h2>
      <p>{{ t('Escreva um lembrete com data e hora ("amanhã 9h") e o Hideout avisa com uma notificação do Windows. Itens sem data vão para o TO DO.') }}</p>
    </div>
    <section v-for="g in groups" :key="g.id">
      <div class="gh" :class="{ late: g.late }">
        <UIcon v-if="g.late" name="i-lucide-circle-alert" class="size-[14px]" />{{ g.name }}
      </div>
      <div v-for="x in g.items" :key="x.id" class="it" @click="S.sheet = { kind: 'task', id: x.id }">
        <button class="ck" :aria-label="t('Concluir {title}', { title: x.title })" :aria-pressed="x.done" @click.stop="toggleTask(x)">
          <UIcon name="i-lucide-check" class="size-[14px]" />
        </button>
        <div class="tt">
          <div class="n">{{ x.title }}</div>
          <div v-if="x.due" class="d" :class="{ late: isPast(x) }">
            <UIcon name="i-lucide-clock" class="size-3" />
            <template v-if="x.snoozedUntil && x.snoozedUntil > x.due">{{ t('Adiado para {date}', { date: dueLabel(x.snoozedUntil) }) }}</template>
            <template v-else>{{ dueLabel(x.due) }}</template>
          </div>
        </div>
        <span v-if="x.repeat !== 'none'" class="pill"><UIcon name="i-lucide-repeat" class="size-3" />{{ t(REPEAT_LABEL[x.repeat]) }}</span>
      </div>
    </section>
    <section v-if="done.length">
      <button class="gh toggle" :aria-expanded="showDone" @click="showDone = !showDone">
        <UIcon name="i-lucide-chevron-down" class="size-[14px] chev" :class="{ closed: !showDone }" />{{ t('Concluídas ({n})', { n: done.length }) }}
      </button>
      <template v-if="showDone">
        <div v-for="x in done" :key="x.id" class="it" @click="S.sheet = { kind: 'task', id: x.id }">
          <button class="ck done" :aria-label="t('Reabrir {title}', { title: x.title })" aria-pressed="true" @click.stop="toggleTask(x)"><UIcon name="i-lucide-check" class="size-[14px]" /></button>
          <div class="tt"><div class="n struck">{{ x.title }}</div></div>
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
  margin: 14px 14px 4px;
  border: 1px solid var(--hx-line);
  border-radius: 11px;
  background: var(--hx-surface);
  padding: 0 6px 0 12px;
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
.when {
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--hx-line);
  background: var(--hx-bg);
  font: inherit;
  font-size: 13px;
  color: var(--hx-soft-ink);
  font-weight: 600;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  flex-shrink: 0;
}
.pop {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 280px;
}
.alert {
  margin: 10px 14px 2px;
  border-radius: 12px;
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
  padding: 10px 10px 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.atx {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.atx b {
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--hx-ink);
}
.atx span {
  font-size: 12.5px;
}
.sbtn {
  height: 32px;
  border-radius: 8px;
  border: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 0 10px;
  cursor: pointer;
  flex-shrink: 0;
}
.sbtn.light {
  background: var(--hx-surface);
  color: var(--hx-soft-ink);
}
.sbtn.dark {
  background: var(--hx-primary);
  color: var(--hx-on-primary);
}
.list {
  flex-grow: 1;
  overflow-y: auto;
  padding-bottom: 12px;
}
.gh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 14px 4px;
  font-weight: 600;
  font-size: 13px;
  opacity: 0.85;
}
.gh.late {
  color: var(--hx-warn);
  opacity: 1;
}
.toggle {
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  font-size: 13px;
  color: var(--hx-ink);
  cursor: pointer;
}
.chev {
  transition: transform 0.15s;
}
.chev.closed {
  transform: rotate(-90deg);
}
.it {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  min-height: 44px;
  box-sizing: border-box;
  cursor: pointer;
}
.it:hover {
  background: var(--hx-bg);
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
.tt {
  flex-grow: 1;
  min-width: 0;
}
.n {
  font-size: 14.5px;
  font-weight: 500;
}
.struck {
  text-decoration: line-through;
  color: var(--hx-muted);
}
.d {
  font-size: 12.5px;
  color: var(--hx-muted);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 1px;
}
.d.late {
  color: var(--hx-warn);
  font-weight: 600;
}
.pill {
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 6px;
  padding: 2px 7px;
  background: var(--hx-bg);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
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
