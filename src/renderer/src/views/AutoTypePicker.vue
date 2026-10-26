<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { template } from '@shared/model'
import { api } from '../api'
import { useCopy } from '../copy'
import { S, live } from '../store'

const term = ref('')
const { fail } = useCopy()

watch(
  () => S.autoType,
  () => (term.value = '')
)

const groups = computed(() => {
  if (!S.data || !S.autoType) return []
  const ids = new Set(S.autoType.ids)
  const all = live(S.data.accesses).filter((a) => a.password || a.username)
  const best = all.filter((a) => ids.has(a.id))
  const toItem = (a: (typeof all)[number]) => ({
    label: a.title || 'Sem nome',
    suffix: a.username,
    icon: template(a.type).icon,
    onSelect: () => run(a.id)
  })
  return [
    ...(best.length ? [{ id: 'best', label: 'Combinam com a janela', items: best.map(toItem) }] : []),
    { id: 'all', label: 'Todos os acessos', items: all.filter((a) => !ids.has(a.id)).map(toItem) }
  ]
})

async function run(id: string | null): Promise<void> {
  S.autoType = null
  try {
    await api('autotype:run', id)
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <UModal :open="!!S.autoType" title="Digitar login" :description="S.autoType ? `Na janela: ${S.autoType.title}` : ''" @update:open="(o) => !o && run(null)">
    <template #content>
      <div class="head">
        <b>Qual login digitar?</b>
        <span class="hx-hint">Janela: {{ S.autoType?.title }}</span>
      </div>
      <UCommandPalette v-model:search-term="term" :groups="groups" placeholder="Buscar acesso" class="h-[min(420px,60vh)]" />
    </template>
  </UModal>
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 16px 6px;
}
</style>
