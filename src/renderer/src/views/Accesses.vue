<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { DEFAULT_CATEGORY, newAccess } from '@shared/model'
import type { Access, Category, CsvRow } from '@shared/types'
import { api } from '../api'
import { useCopy } from '../copy'
import { NOTE_COLORS } from '../format'
import { S, categoryList, deleteCategory, live, moveAccess, moveCategory, upsertAccess } from '../store'
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

interface Group {
  id: string
  name: string
  items: Access[]
  category: Category | null
  icon: string
  color: string
}

// Pastel swatch mixed with the text color, so the icon stays readable on every theme.
const colorHex = (id: string): string => `color-mix(in srgb, ${NOTE_COLORS.find((c) => c.id === id)?.hex ?? NOTE_COLORS[0].hex} 55%, var(--hx-ink))`

const groups = computed<Group[]>(() => {
  const items = live(S.data!.accesses).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  const fav = items.filter((a) => a.favorite)
  const list: Group[] = categoryList().map((c) => ({
    id: c.id,
    name: c.name,
    items: items.filter((a) => (a.category || DEFAULT_CATEGORY) === c.name),
    category: c,
    icon: c.icon,
    color: colorHex(c.color)
  }))
  return fav.length ? [{ id: 'fav', name: 'Favoritos', items: fav, category: null, icon: 'i-lucide-star', color: 'var(--hx-warn)' }, ...list] : list
})
const total = computed(() => live(S.data!.accesses).length)

function groupMenu(g: Group) {
  const c = g.category!
  const list = categoryList()
  const i = list.findIndex((x) => x.id === c.id)
  const canDelete = !(c.name === DEFAULT_CATEGORY && g.items.length)
  return [
    [
      { label: 'Novo acesso aqui', icon: 'i-lucide-plus', onSelect: () => (S.sheet = { kind: 'access', id: null, type: 'login', category: c.name }) },
      { label: 'Editar nome, ícone e cor', icon: 'i-lucide-pencil', onSelect: () => (S.categoryDialog = { id: c.id }) }
    ],
    [
      { label: 'Mover para cima', icon: 'i-lucide-arrow-up', disabled: i <= 0, onSelect: () => moveCategory(c.id, -1) },
      { label: 'Mover para baixo', icon: 'i-lucide-arrow-down', disabled: i >= list.length - 1, onSelect: () => moveCategory(c.id, 1) }
    ],
    [
      {
        label: canDelete ? 'Excluir categoria' : 'Geral não pode ser excluída com acessos dentro',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        disabled: !canDelete,
        onSelect: () => {
          const moved = deleteCategory(c.id)
          info('Categoria excluída', moved > 0 ? `${moved} ${moved === 1 ? 'acesso foi' : 'acessos foram'} para ${DEFAULT_CATEGORY}.` : undefined)
        }
      }
    ]
  ]
}

// Drag a row onto another category to move it.
const dropTarget = ref<string | null>(null)
function onDrop(g: Group, e: DragEvent): void {
  dropTarget.value = null
  const id = e.dataTransfer?.getData('application/x-hideout-access')
  if (id && g.category) {
    moveAccess(id, g.category.name)
    info(`Movido para ${g.category.name}`)
  }
}

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
    <template v-if="total || groups.length > 1">
      <section
        v-for="g in groups"
        :key="g.id"
        class="group"
        :class="{ drop: dropTarget === g.id }"
        @dragover.prevent="g.category && (dropTarget = g.id)"
        @dragleave.self="dropTarget = null"
        @drop.prevent="onDrop(g, $event)"
      >
        <div class="gh">
          <button class="toggle" :aria-expanded="!collapsed[g.id]" @click="collapsed[g.id] = !collapsed[g.id]">
            <UIcon name="i-lucide-chevron-down" class="size-[15px] chev" :class="{ closed: collapsed[g.id] }" />
            <span class="cat" :style="{ color: g.color }"><UIcon :name="g.icon" class="size-[15px]" /></span>
            <span>{{ g.name }}</span>
            <span class="count">{{ g.items.length }}</span>
          </button>
          <template v-if="g.category">
            <UTooltip text="Novo acesso nesta categoria">
              <button class="hx-ib small" aria-label="Novo acesso nesta categoria" @click="S.sheet = { kind: 'access', id: null, type: 'login', category: g.name }">
                <UIcon name="i-lucide-plus" class="size-4" />
              </button>
            </UTooltip>
            <UDropdownMenu :items="groupMenu(g)" :content="{ align: 'end' }">
              <button class="hx-ib small" :aria-label="`Opções da categoria ${g.name}`"><UIcon name="i-lucide-ellipsis" class="size-4" /></button>
            </UDropdownMenu>
          </template>
        </div>
        <template v-if="!collapsed[g.id]">
          <AccessRow v-for="a in g.items" :key="`${g.id}-${a.id}`" :a="a" />
          <p v-if="!g.items.length" class="none">
            Nenhum acesso aqui ainda. Crie um com o + ou arraste um acesso de outra categoria.
          </p>
        </template>
      </section>
    </template>
  </div>
  <div class="foot">
    <UDropdownMenu
      :items="[[{ label: 'Nova categoria', icon: 'i-lucide-folder-plus', onSelect: () => (S.categoryDialog = { id: null }) }, { label: 'Importar do navegador (CSV)', icon: 'i-lucide-upload', onSelect: importCsv }]]"
      :content="{ align: 'start', side: 'top' }"
    >
      <button class="hx-btn hx-ghost"><UIcon name="i-lucide-folder-plus" class="size-4" />Organizar<UIcon name="i-lucide-chevron-up" class="size-3.5 opacity-60" /></button>
    </UDropdownMenu>
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
.group {
  transition: background-color 0.15s, box-shadow 0.15s;
}
.group.drop {
  background: var(--hx-soft);
  box-shadow: inset 0 0 0 2px var(--hx-primary);
}
.cat {
  display: inline-flex;
}
.none {
  margin: 0;
  padding: 10px 14px 14px 38px;
  font-size: 13px;
  color: var(--hx-muted);
  border-top: 1px solid var(--hx-line);
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
