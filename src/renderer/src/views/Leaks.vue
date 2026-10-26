<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { LeakResult } from '@shared/types'
import { api, onMain } from '../api'
import { useCopy } from '../copy'
import { locale, t } from '../i18n'
import { S, live } from '../store'
import Sheet from '../components/Sheet.vue'

const { fail } = useCopy()
const running = ref(false)
const progress = ref({ done: 0, total: 0 })
const off = onMain('leaks:progress', (p: { done: number; total: number }) => (progress.value = p))
onBeforeUnmount(off)

const withPassword = computed(() => live(S.data!.accesses).filter((a) => a.password).length)
const results = computed(() =>
  (S.leaks?.found ?? [])
    .map((r) => ({ ...r, a: S.data!.accesses.find((x) => x.id === r.id) }))
    .filter((r) => r.a && !r.a.deletedAt)
)
const when = computed(() => (S.leaks ? new Date(S.leaks.at).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }) : ''))

async function run(): Promise<void> {
  running.value = true
  progress.value = { done: 0, total: 0 }
  try {
    const found = await api<LeakResult[]>('leaks:check')
    S.leaks = { at: new Date().toISOString(), found }
  } catch (e) {
    fail(e)
  } finally {
    running.value = false
  }
}

const fmt = (n: number): string => n.toLocaleString(locale.value)
</script>

<template>
  <Sheet :title="t('Verificar vazamentos')" back @close="S.sheet = null">
    <div class="intro">
      <UIcon name="i-lucide-shield-alert" class="size-8 shrink-0 ic" />
      <p>
        {{ t('Confere se alguma das suas senhas já apareceu em vazamentos públicos, usando o serviço Have I Been Pwned. Só os 5 primeiros caracteres de um código (hash) de cada senha saem do computador; a senha em si nunca sai.') }}
      </p>
    </div>

    <button class="hx-btn hx-primary run" :disabled="running || !withPassword" @click="run">
      <UIcon :name="running ? 'i-lucide-loader-circle' : 'i-lucide-search-check'" class="size-4" :class="{ spin: running }" />
      <template v-if="running">{{ t('Verificando… {done} de {total}', { done: progress.done, total: progress.total || '…' }) }}</template>
      <template v-else-if="S.leaks">{{ t('Verificar de novo') }}</template>
      <template v-else>{{ t('Verificar {n} senhas', { n: withPassword }) }}</template>
    </button>

    <template v-if="S.leaks && !running">
      <div v-if="!results.length" class="ok" role="status">
        <UIcon name="i-lucide-shield-check" class="size-6 shrink-0" />
        <span>{{ t('Nenhuma das suas senhas aparece em vazamentos conhecidos. Verificado às {time}.', { time: when }) }}</span>
      </div>
      <template v-else>
        <div class="bad" role="status">
          <UIcon name="i-lucide-triangle-alert" class="size-6 shrink-0" />
          <span>{{ results.length === 1 ? t('1 senha apareceu em vazamentos. Troque essa senha no site e depois aqui.') : t('{n} senhas apareceram em vazamentos. Troque essas senhas nos sites e depois aqui.', { n: results.length }) }}</span>
        </div>
        <button v-for="r in results" :key="r.id" class="item" @click="S.sheet = { kind: 'access', id: r.id }">
          <span class="txt">
            <b>{{ r.a!.title || t('Sem nome') }}</b>
            <span>{{ r.a!.username || r.a!.url }}</span>
          </span>
          <span class="count">{{ t('{n} vezes', { n: fmt(r.count) }) }}</span>
          <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 opacity-60" />
        </button>
        <p class="hx-hint">{{ t('O número mostra quantas vezes a senha aparece nas bases de vazamento. Mesmo uma vez já é motivo para trocar.') }}</p>
      </template>
    </template>
  </Sheet>
</template>

<style scoped>
.intro {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.intro p {
  margin: 0;
  line-height: 1.55;
  color: var(--hx-muted);
}
.ic {
  color: var(--hx-primary);
}
.run {
  align-self: flex-start;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.ok,
.bad {
  display: flex;
  gap: 12px;
  align-items: center;
  border-radius: 12px;
  padding: 14px 16px;
  font-weight: 600;
  line-height: 1.45;
}
.ok {
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
}
.bad {
  background: var(--hx-danger-soft);
  color: var(--hx-danger);
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  border: 0;
  border-top: 1px solid var(--hx-line);
  background: none;
  text-align: left;
  font: inherit;
  color: var(--hx-ink);
  cursor: pointer;
}
.item:hover {
  background: var(--hx-bg);
}
.txt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.txt span {
  font-size: 13px;
  color: var(--hx-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.count {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--hx-danger);
  background: var(--hx-danger-soft);
  border-radius: 6px;
  padding: 3px 8px;
  white-space: nowrap;
}
</style>
