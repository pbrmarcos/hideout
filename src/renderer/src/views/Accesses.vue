<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { newAccess } from '@shared/model'
import type { CsvRow } from '@shared/types'
import { api } from '../api'
import { useCopy } from '../copy'
import { S, live, upsertAccess } from '../store'
import AccessRow from '../components/AccessRow.vue'

const { fail, info } = useCopy()

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('hx-collapsed') ?? '{}')
  } catch {
    return {}
  }
}
const collapsed = reactive<Record<string, boolean>>(loadCollapsed())
watch(collapsed, (v) => {
  try {
    localStorage.setItem('hx-collapsed', JSON.stringify(v))
  } catch {
    /* per-viewer convenience only */
  }
})

const groups = computed(() => {
  const items = live(S.data!.accesses).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  const fav = items.filter((a) => a.favorite)
  const byCat = new Map<string, typeof items>()
  for (const a of items) {
    const c = a.category || 'Geral'
    byCat.set(c, [...(byCat.get(c) ?? []), a])
  }
  const list = [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([name, items]) => ({ id: `c:${name}`, name, items }))
  return fav.length ? [{ id: 'fav', name: 'Favoritos', items: fav }, ...list] : list
})
const total = computed(() => live(S.data!.accesses).length)

async function importCsv(): Promise<void> {
  try {
    const rows = await api<CsvRow[]>('csv:import')
    if (!rows.length) return
    const existing = new Set(live(S.data!.accesses).map((a) => `${a.url}|${a.username}`))
    let added = 0
    for (const r of rows) {
      if (existing.has(`${r.url}|${r.username}`)) continue
      const a = newAccess('login', 'Importados')
      let host = r.url
      try {
        host = new URL(r.url).hostname.replace(/^www\./, '')
      } catch {
        /* keep the raw value */
      }
      upsertAccess({ ...a, title: r.name || host || 'Sem nome', url: r.url, username: r.username, password: r.password, notes: r.note })
      existing.add(`${r.url}|${r.username}`)
      added++
    }
    info(added === 1 ? '1 acesso importado' : `${added} acessos importados`, 'Estão na categoria Importados. Depois apague o arquivo CSV: ele não é criptografado.')
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <div class="list">
    <div v-if="!total" class="empty">
      <UIcon name="i-lucide-key-round" class="size-9 icon" />
      <h2>Guarde seu primeiro acesso</h2>
      <p>Clique em uma senha para copiar. Ela some da área de transferência sozinha depois de alguns segundos.</p>
      <div class="actions">
        <button class="hx-btn hx-primary" @click="S.sheet = { kind: 'templates' }"><UIcon name="i-lucide-plus" class="size-4" />Novo acesso</button>
        <button class="hx-btn hx-soft" @click="importCsv"><UIcon name="i-lucide-upload" class="size-4" />Importar do navegador</button>
      </div>
    </div>
    <section v-for="g in groups" :key="g.id" class="group">
      <div class="gh">
        <button class="toggle" :aria-expanded="!collapsed[g.id]" @click="collapsed[g.id] = !collapsed[g.id]">
          <UIcon name="i-lucide-chevron-down" class="size-[15px] chev" :class="{ closed: collapsed[g.id] }" />
          <UIcon v-if="g.id === 'fav'" name="i-lucide-star" class="size-[14px]" />
          <span>{{ g.name }}</span>
          <span class="count">{{ g.items.length }}</span>
        </button>
        <UTooltip v-if="g.id !== 'fav'" text="Novo acesso nesta categoria">
          <button class="hx-ib small" aria-label="Novo acesso nesta categoria" @click="S.sheet = { kind: 'access', id: null, type: 'login', category: g.name }">
            <UIcon name="i-lucide-plus" class="size-4" />
          </button>
        </UTooltip>
      </div>
      <template v-if="!collapsed[g.id]">
        <AccessRow v-for="a in g.items" :key="`${g.id}-${a.id}`" :a="a" />
      </template>
    </section>
  </div>
  <div class="foot">
    <button class="hx-btn hx-ghost" @click="importCsv"><UIcon name="i-lucide-upload" class="size-4" />Importar do navegador</button>
    <span class="grow" />
    <button class="hx-btn hx-primary" @click="S.sheet = { kind: 'templates' }"><UIcon name="i-lucide-plus" class="size-4" />Novo</button>
  </div>
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
  padding: 12px 10px 6px 8px;
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
  padding: 4px 6px;
  border-radius: 6px;
  flex-grow: 1;
  text-align: left;
}
.toggle:hover {
  background: var(--hx-bg);
}
.chev {
  transition: transform 0.15s;
}
.chev.closed {
  transform: rotate(-90deg);
}
.count {
  color: var(--hx-muted);
  font-weight: 500;
}
.small {
  width: 28px;
  height: 28px;
}
.foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 14px;
  border-top: 1px solid var(--hx-line);
}
.grow {
  flex-grow: 1;
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
.actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
