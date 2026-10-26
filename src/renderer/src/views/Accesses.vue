<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { DEFAULT_CATEGORY, newAccess } from '@shared/model'
import type { Access, Category, CsvRow, SortMode } from '@shared/types'
import { api } from '../api'
import { useCopy } from '../copy'
import { NOTE_COLORS } from '../format'
import { t } from '../i18n'
import {
  S, catName, categoryList, deleteCategory, live, moveCategory, placeAccess, placeCategory, setView, sortAccesses, upsertAccess
} from '../store'
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
    /* per-computer convenience only */
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
const colorOf = (id: string): string => `color-mix(in srgb, ${NOTE_COLORS.find((c) => c.id === id)?.hex ?? NOTE_COLORS[0].hex} 55%, var(--hx-ink))`

const manual = computed(() => S.view.sort === 'manual')
const total = computed(() => live(S.data!.accesses).length)

const groups = computed<Group[]>(() => {
  const all = live(S.data!.accesses)
  const sorted = (list: Access[]): Access[] => sortAccesses(list, S.view.sort)
  const fav: Group = { id: 'fav', name: t('Favoritos'), items: sorted(all.filter((a) => a.favorite)), category: null, icon: 'i-lucide-star', color: 'var(--hx-warn)' }
  const cats: Group[] = categoryList().map((c) => ({
    id: c.id,
    name: c.name,
    items: sorted(all.filter((a) => (a.category || DEFAULT_CATEGORY) === c.name)),
    category: c,
    icon: c.icon,
    color: colorOf(c.color)
  }))
  if (S.view.filter === 'fav') return [fav]
  if (S.view.filter) return cats.filter((g) => g.id === S.view.filter)
  return fav.items.length ? [fav, ...cats] : cats
})

// A filter pointing to a deleted category falls back to "all".
watch(
  () => categoryList().map((c) => c.id).join(),
  () => {
    if (S.view.filter && S.view.filter !== 'fav' && !categoryList().some((c) => c.id === S.view.filter)) setView({ filter: null })
  }
)

const sortItems = computed(() => [
  (['manual', 'name', 'used', 'recent'] as SortMode[]).map((m) => ({
    label: { manual: t('Minha ordem (arrastar)'), name: t('Nome (A–Z)'), used: t('Mais usados'), recent: t('Usados recentemente') }[m],
    icon: S.view.sort === m ? 'i-lucide-check' : undefined,
    onSelect: () => setView({ sort: m })
  }))
])
const sortLabel = computed(() => ({ manual: t('Minha ordem'), name: t('Nome'), used: t('Mais usados'), recent: t('Recentes') })[S.view.sort])

function groupMenu(g: Group) {
  const c = g.category!
  const list = categoryList()
  const i = list.findIndex((x) => x.id === c.id)
  const canDelete = !(c.name === DEFAULT_CATEGORY && g.items.length)
  return [
    [
      { label: t('Novo acesso aqui'), icon: 'i-lucide-plus', onSelect: () => (S.sheet = { kind: 'access', id: null, type: 'login', category: c.name }) },
      { label: t('Editar nome, ícone e cor'), icon: 'i-lucide-pencil', onSelect: () => (S.categoryDialog = { id: c.id }) }
    ],
    [
      { label: t('Mover para cima'), icon: 'i-lucide-arrow-up', disabled: i <= 0, onSelect: () => moveCategory(c.id, -1) },
      { label: t('Mover para baixo'), icon: 'i-lucide-arrow-down', disabled: i >= list.length - 1, onSelect: () => moveCategory(c.id, 1) }
    ],
    [
      {
        label: canDelete ? t('Excluir categoria') : t('Geral não pode ser excluída com acessos dentro'),
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        disabled: !canDelete,
        onSelect: () => {
          const moved = deleteCategory(c.id)
          info(t('Categoria excluída'), moved > 0 ? (moved === 1 ? t('1 acesso foi para {cat}.', { cat: t(DEFAULT_CATEGORY) }) : t('{n} acessos foram para {cat}.', { n: moved, cat: t(DEFAULT_CATEGORY) })) : undefined)
        }
      }
    ]
  ]
}

// --- drag and drop: accesses between/inside categories, categories up and down --------------
const drag = ref<{ kind: 'access' | 'category'; id: string } | null>(null)
const over = ref<string | null>(null)

function onCategoryDragStart(g: Group, e: DragEvent): void {
  if (!g.category) return
  drag.value = { kind: 'category', id: g.category.id }
  e.dataTransfer?.setData('text/plain', g.name)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onRowDragStart(id: string): void {
  drag.value = { kind: 'access', id }
}

function onDragOver(target: string, e: DragEvent): void {
  if (!drag.value) return
  e.preventDefault()
  over.value = target
}

/** Dropped on a category header or empty area: append (access) or place before (category). */
function onDropGroup(g: Group): void {
  const d = drag.value
  over.value = null
  drag.value = null
  if (!d || !g.category) return
  if (d.kind === 'category') return placeCategory(d.id, g.category.id)
  const a = S.data!.accesses.find((x) => x.id === d.id)
  placeAccess(d.id, g.category.name, null)
  if (a && a.category !== g.category.name) info(t('Movido para {cat}', { cat: g.category.name }))
}

/** Dropped on a row: in "my order" the access goes right before it. */
function onDropRow(g: Group, before: Access): void {
  const d = drag.value
  over.value = null
  drag.value = null
  if (!d || !g.category || d.kind !== 'access') return onDropGroup(g)
  placeAccess(d.id, g.category.name, manual.value ? before.id : null)
}

function endDrag(): void {
  drag.value = null
  over.value = null
}

async function importCsv(): Promise<void> {
  try {
    const rows = await api<CsvRow[]>('csv:import')
    if (!rows.length) return
    const existing = new Set(live(S.data!.accesses).map((a) => `${a.url}|${a.username}`))
    const category = t('Importados')
    let added = 0
    for (const r of rows) {
      if (existing.has(`${r.url}|${r.username}`)) continue
      const a = newAccess('login', category)
      let host = r.url
      try {
        host = new URL(r.url).hostname.replace(/^www\./, '')
      } catch {
        /* keep the raw value */
      }
      upsertAccess({ ...a, title: r.name || host || t('Sem nome'), url: r.url, username: r.username, password: r.password, notes: r.note })
      existing.add(`${r.url}|${r.username}`)
      added++
    }
    info(added === 1 ? t('1 acesso importado') : t('{n} acessos importados', { n: added }), t('Estão na categoria {cat}. Depois apague o arquivo CSV: ele não é criptografado.', { cat: category }))
  } catch (e) {
    fail(e)
  }
}

const organizeMenu = computed(() => [
  [
    { label: t('Nova categoria'), icon: 'i-lucide-folder-plus', onSelect: () => (S.categoryDialog = { id: null }) },
    { label: t('Importar do navegador (CSV)'), icon: 'i-lucide-upload', onSelect: importCsv }
  ],
  [{ label: t('Verificar vazamentos'), icon: 'i-lucide-shield-alert', onSelect: () => (S.sheet = { kind: 'leaks' }) }]
])
</script>

<template>
  <div class="bar">
    <div class="filters" role="toolbar" :aria-label="t('Filtrar acessos')">
      <button class="chip" :class="{ on: !S.view.filter }" :aria-pressed="!S.view.filter" @click="setView({ filter: null })">{{ t('Todos') }}</button>
      <button class="chip" :class="{ on: S.view.filter === 'fav' }" :aria-pressed="S.view.filter === 'fav'" @click="setView({ filter: 'fav' })">
        <UIcon name="i-lucide-star" class="size-3.5" />{{ t('Favoritos') }}
      </button>
      <button
        v-for="c in categoryList()"
        :key="c.id"
        class="chip"
        :class="{ on: S.view.filter === c.id }"
        :aria-pressed="S.view.filter === c.id"
        @click="setView({ filter: S.view.filter === c.id ? null : c.id })"
      >
        <UIcon :name="c.icon" class="size-3.5" :style="{ color: colorOf(c.color) }" />{{ catName(c.name) }}
      </button>
    </div>
    <UDropdownMenu :items="sortItems" :content="{ align: 'end' }">
      <button class="sort" :aria-label="t('Ordenar por: {mode}', { mode: sortLabel })">
        <UIcon name="i-lucide-arrow-up-down" class="size-4" /><span>{{ sortLabel }}</span>
      </button>
    </UDropdownMenu>
  </div>

  <div class="list" @dragend="endDrag">
    <div v-if="!total" class="empty">
      <UIcon name="i-lucide-key-round" class="size-9 icon" />
      <h2>{{ t('Guarde seu primeiro acesso') }}</h2>
      <p>{{ t('Clique em uma senha para copiar. Ela some da área de transferência sozinha depois de alguns segundos.') }}</p>
      <div class="actions">
        <button class="hx-btn hx-primary" @click="S.sheet = { kind: 'templates' }"><UIcon name="i-lucide-plus" class="size-4" />{{ t('Novo acesso') }}</button>
        <button class="hx-btn hx-soft" @click="importCsv"><UIcon name="i-lucide-upload" class="size-4" />{{ t('Importar do navegador') }}</button>
      </div>
    </div>
    <template v-if="total || groups.length > 1">
      <p v-if="S.view.filter === 'fav' && !groups[0]?.items.length" class="none">{{ t('Nenhum favorito ainda. Clique com o botão direito num acesso e escolha "Adicionar aos favoritos".') }}</p>
      <section
        v-for="g in groups"
        :key="g.id"
        class="group"
        :class="{ drop: over === g.id && drag?.kind === 'access', above: over === g.id && drag?.kind === 'category' }"
        @dragover="g.category && onDragOver(g.id, $event)"
        @drop.prevent="onDropGroup(g)"
      >
        <div class="gh" :draggable="!!g.category && manual" @dragstart="onCategoryDragStart(g, $event)">
          <span v-if="g.category && manual" class="grip" aria-hidden="true"><UIcon name="i-lucide-grip-vertical" class="size-3.5" /></span>
          <button class="toggle" :aria-expanded="!collapsed[g.id]" @click="collapsed[g.id] = !collapsed[g.id]">
            <UIcon name="i-lucide-chevron-down" class="size-[15px] chev" :class="{ closed: collapsed[g.id] }" />
            <span class="cat" :style="{ color: g.color }"><UIcon :name="g.icon" class="size-[15px]" /></span>
            <span>{{ g.category ? catName(g.name) : g.name }}</span>
            <span class="count">{{ g.items.length }}</span>
          </button>
          <template v-if="g.category">
            <UTooltip :text="t('Novo acesso nesta categoria')">
              <button class="hx-ib small" :aria-label="t('Novo acesso nesta categoria')" @click="S.sheet = { kind: 'access', id: null, type: 'login', category: g.name }">
                <UIcon name="i-lucide-plus" class="size-4" />
              </button>
            </UTooltip>
            <UDropdownMenu :items="groupMenu(g)" :content="{ align: 'end' }">
              <button class="hx-ib small" :aria-label="t('Opções da categoria {name}', { name: g.name })"><UIcon name="i-lucide-ellipsis" class="size-4" /></button>
            </UDropdownMenu>
          </template>
        </div>
        <template v-if="!collapsed[g.id]">
          <AccessRow
            v-for="a in g.items"
            :key="`${g.id}-${a.id}`"
            :a="a"
            :before="manual && over === `row:${a.id}` && drag?.kind === 'access' && drag.id !== a.id"
            @dragstart="onRowDragStart(a.id)"
            @dragover="(e: DragEvent) => { e.stopPropagation(); if (g.category) onDragOver(`row:${a.id}`, e) }"
            @drop="onDropRow(g, a)"
          />
          <p v-if="!g.items.length && g.category" class="none">{{ t('Nenhum acesso aqui ainda. Crie um com o + ou arraste um acesso de outra categoria.') }}</p>
        </template>
      </section>
      <p v-if="manual && categoryList().length > 1 && !S.view.filter" class="hint">{{ t('Dica: arraste categorias pelo título e acessos pela linha para mudar a ordem.') }}</p>
    </template>
  </div>
  <div class="foot">
    <UDropdownMenu :items="organizeMenu" :content="{ align: 'start', side: 'top' }">
      <button class="hx-btn hx-ghost"><UIcon name="i-lucide-folder-plus" class="size-4" />{{ t('Organizar') }}<UIcon name="i-lucide-chevron-up" class="size-3.5 opacity-60" /></button>
    </UDropdownMenu>
    <span class="grow" />
    <button class="hx-btn hx-primary" @click="S.sheet = { kind: 'templates' }"><UIcon name="i-lucide-plus" class="size-4" />{{ t('Novo') }}</button>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 8px 6px 12px;
  border-bottom: 1px solid var(--hx-line);
}
.filters {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 2px;
}
.filters::-webkit-scrollbar {
  display: none;
}
.chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 11px;
  border-radius: 15px;
  border: 0;
  background: var(--hx-bg);
  color: var(--hx-ink);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.chip:hover {
  background: var(--hx-line);
}
.chip.on {
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
  box-shadow: inset 0 0 0 1.5px var(--hx-primary);
}
.sort {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: var(--hx-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.sort:hover {
  background: var(--hx-bg);
  color: var(--hx-ink);
}
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
.group.above {
  box-shadow: inset 0 3px 0 var(--hx-primary);
}
:deep(.row.before) {
  box-shadow: inset 0 3px 0 var(--hx-primary);
}
.gh {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 10px 6px 8px;
}
.gh[draggable='true'] {
  cursor: grab;
}
.grip {
  color: var(--hx-muted);
  opacity: 0.5;
  display: inline-flex;
  margin-right: -4px;
}
.gh:hover .grip {
  opacity: 1;
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
.cat {
  display: inline-flex;
}
.count {
  color: var(--hx-muted);
  font-weight: 500;
}
.small {
  width: 28px;
  height: 28px;
}
.none {
  margin: 0;
  padding: 10px 14px 14px 38px;
  font-size: 13px;
  color: var(--hx-muted);
  border-top: 1px solid var(--hx-line);
}
.hint {
  margin: 14px 14px 0;
  font-size: 12px;
  color: var(--hx-muted);
  text-align: center;
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
