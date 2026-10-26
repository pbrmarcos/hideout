<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { TimerState } from '@shared/types'
import { api } from '../api'
import { clock, parseDuration } from '../format'
import { t } from '../i18n'
import { S } from '../store'

const MIN = 60_000
const open = ref(false)
const draft = ref<string | null>(null)
const bad = ref(false)

// Ticks only while the countdown runs.
const tick = ref(Date.now())
let handle: ReturnType<typeof setInterval> | null = null
watch(
  () => S.timer.running,
  (running) => {
    if (handle) clearInterval(handle)
    handle = running ? setInterval(() => (tick.value = Date.now()), 250) : null
  },
  { immediate: true }
)
onBeforeUnmount(() => handle && clearInterval(handle))

const left = computed(() => (S.timer.running && S.timer.endsAt ? Math.max(0, S.timer.endsAt - tick.value) : S.timer.remaining))
/** Paused midway: still worth showing in the bar. */
const paused = computed(() => !S.timer.running && S.timer.remaining < S.timer.total)
const shown = computed(() => draft.value ?? clock(left.value))

async function call(channel: string, ...args: unknown[]): Promise<void> {
  S.timer = await api<TimerState>(channel, ...args)
}

const steps = [-10, -5, 5, 10]

function commit(): void {
  if (draft.value === null) return
  const ms = parseDuration(draft.value)
  if (ms === null) {
    bad.value = true
    return
  }
  draft.value = null
  bad.value = false
  void call(S.timer.running ? 'timer:start' : 'timer:set', ms)
}

function onEnter(): void {
  const editing = draft.value !== null
  commit()
  // Enter on an untouched field starts or pauses, like the main button.
  if (!editing) toggle()
}

function toggle(): void {
  if (draft.value !== null) {
    const ms = parseDuration(draft.value)
    if (ms === null) return void (bad.value = true)
    draft.value = null
    bad.value = false
    return void call('timer:start', ms)
  }
  void call(S.timer.running ? 'timer:pause' : 'timer:start')
}

function cancelEdit(): void {
  draft.value = null
  bad.value = false
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end', sideOffset: 6 }" @update:open="(o) => !o && cancelEdit()">
    <UTooltip :text="t('Temporizador')" :disabled="open">
      <button class="hx-ib tbtn" :class="{ live: S.timer.running, paused }" :aria-label="t('Temporizador')">
        <UIcon name="i-lucide-timer" class="size-[17px]" />
        <span v-if="S.timer.running || paused" class="mini" aria-live="off">{{ clock(left) }}</span>
      </button>
    </UTooltip>
    <template #content>
      <div class="pop" @keydown.esc.stop="cancelEdit">
        <div class="row">
          <button v-for="n in steps.slice(0, 2)" :key="n" class="step" :aria-label="t('Tirar {n} min', { n: -n })" @click="call('timer:add', n * MIN)">−{{ -n }}</button>
          <input
            class="time"
            :class="{ bad, long: shown.length > 5 }"
            :value="shown"
            inputmode="numeric"
            :aria-label="t('Tempo do temporizador')"
            @focus="(e) => (e.target as HTMLInputElement).select()"
            @input="(e) => ((draft = (e.target as HTMLInputElement).value), (bad = false))"
            @keydown.enter.prevent="onEnter"
            @blur="commit"
          />
          <button v-for="n in steps.slice(2)" :key="n" class="step" :aria-label="t('Somar {n} min', { n })" @click="call('timer:add', n * MIN)">+{{ n }}</button>
        </div>
        <p class="hint" :class="{ bad }">{{ bad ? t('Não entendi. Use 25, 25:00 ou 1:30:00.') : t('Clique no tempo para digitar: 25, 25:00 ou 1:30:00.') }}</p>
        <div class="acts">
          <button class="hx-btn hx-primary main" @mousedown.prevent @click="toggle">
            <UIcon :name="S.timer.running ? 'i-lucide-pause' : 'i-lucide-play'" class="size-4" />
            {{ S.timer.running ? t('Pausar') : paused ? t('Continuar') : t('Iniciar') }}
          </button>
          <UTooltip :text="t('Voltar para {time}', { time: clock(S.timer.total) })">
            <button class="hx-ib reset" :aria-label="t('Voltar para {time}', { time: clock(S.timer.total) })" :disabled="!S.timer.running && !paused" @click="call('timer:reset')">
              <UIcon name="i-lucide-rotate-ccw" class="size-4" />
            </button>
          </UTooltip>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.tbtn {
  width: auto;
  min-width: 32px;
  padding: 0 7px;
  gap: 5px;
}
.tbtn.live {
  color: var(--hx-primary);
}
.mini {
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.tbtn.paused .mini {
  color: var(--hx-muted);
}
.pop {
  padding: 14px;
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: grid;
  grid-template-columns: 40px 40px 1fr 40px 40px;
  gap: 6px;
  align-items: center;
}
.step {
  height: 36px;
  border-radius: 9px;
  border: 1px solid var(--hx-line);
  background: var(--hx-bg);
  color: var(--hx-ink);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.step:hover {
  border-color: var(--hx-primary);
  color: var(--hx-primary);
}
.time {
  min-width: 0;
  height: 44px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
  font: inherit;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
  outline: 0;
}
.time:focus {
  border-color: var(--hx-primary);
  background: var(--hx-surface);
  color: var(--hx-ink);
}
.time.long {
  font-size: 17px;
}
.time.bad {
  border-color: var(--hx-danger);
}
.hint {
  margin: 0;
  font-size: 12px;
  color: var(--hx-muted);
  text-align: center;
}
.hint.bad {
  color: var(--hx-danger);
}
.acts {
  display: flex;
  gap: 8px;
  align-items: center;
}
.main {
  flex-grow: 1;
  justify-content: center;
}
</style>
