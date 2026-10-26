<script setup lang="ts">
import { computed, ref } from 'vue'
import { template } from '@shared/model'
import type { Access } from '@shared/types'
import { api } from '../api'
import { useCopy } from '../copy'
import { S, categoryList, moveAccess, trash, upsertAccess } from '../store'
import PasswordSeal from './PasswordSeal.vue'

const props = defineProps<{ a: Access }>()
const shown = ref(false)
const { copy, fail } = useCopy()

const HUES = 6
const hue = computed(() => {
  let h = 0
  for (const ch of props.a.title) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % HUES
})
const t = computed(() => template(props.a.type))
const subtitle = computed(() => props.a.username || (props.a.url ? props.a.url.replace(/^https?:\/\//, '') : t.value.label))

function open(): void {
  S.sheet = { kind: 'access', id: props.a.id }
}

function copyPassword(): void {
  copy(props.a.password, { key: props.a.id, secret: true, label: t.value.passwordLabel ?? 'Senha' }).catch(fail)
}
function copyUser(): void {
  copy(props.a.username, { label: t.value.usernameLabel ?? 'Usuário' }).catch(fail)
}
function openUrl(): void {
  api('shell:open', props.a.url).catch(fail)
}

const menu = computed(() => [
  [
    { label: 'Editar', icon: 'i-lucide-pencil', onSelect: open },
    ...(props.a.password ? [{ label: `Copiar ${t.value.passwordLabel?.toLowerCase() ?? 'senha'}`, icon: 'i-lucide-key-round', onSelect: copyPassword }] : []),
    ...(props.a.username ? [{ label: `Copiar ${t.value.usernameLabel?.toLowerCase() ?? 'usuário'}`, icon: 'i-lucide-user', onSelect: copyUser }] : []),
    ...(props.a.url ? [{ label: 'Abrir link', icon: 'i-lucide-external-link', onSelect: openUrl }] : [])
  ],
  [
    {
      label: 'Mover para',
      icon: 'i-lucide-folder-input',
      children: [
        categoryList().map((c) => ({
          label: c.name,
          icon: c.icon,
          disabled: c.name === props.a.category,
          onSelect: () => moveAccess(props.a.id, c.name)
        })),
        [{ label: 'Nova categoria…', icon: 'i-lucide-folder-plus', onSelect: () => (S.categoryDialog = { id: null }) }]
      ]
    },
    {
      label: props.a.favorite ? 'Tirar dos favoritos' : 'Adicionar aos favoritos',
      icon: 'i-lucide-star',
      onSelect: () => upsertAccess({ ...props.a, favorite: !props.a.favorite })
    }
  ],
  [{ label: 'Excluir', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => trash('accesses', props.a.id) }]
])

function onDragStart(e: DragEvent): void {
  e.dataTransfer?.setData('application/x-hideout-access', props.a.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
</script>

<template>
  <UContextMenu :items="menu">
  <div class="row" draggable="true" @dragstart="onDragStart" @click="open" @keydown.enter.self="open" tabindex="0" :aria-label="`Abrir ${a.title}`">
    <div class="av" :class="`h${hue}`" aria-hidden="true">
      <UIcon v-if="a.type !== 'login'" :name="t.icon" class="size-[17px]" />
      <template v-else>{{ (a.title || '?')[0].toUpperCase() }}</template>
    </div>
    <div class="txt">
      <span class="t">{{ a.title || 'Sem nome' }}</span>
      <button v-if="a.username" class="u" :title="`Copiar ${t.usernameLabel?.toLowerCase() ?? 'usuário'}`" @click.stop="copyUser">{{ subtitle }}</button>
      <span v-else class="u plain">{{ subtitle }}</span>
    </div>
    <template v-if="a.password">
      <PasswordSeal :copy-key="a.id" :value="a.password" :shown="shown" :label="t.passwordLabel?.toLowerCase()" @copy="copyPassword" />
      <UTooltip :text="shown ? 'Ocultar' : 'Mostrar'">
        <button class="hx-ib" :aria-label="shown ? 'Ocultar senha' : 'Mostrar senha'" @click.stop="shown = !shown">
          <UIcon :name="shown ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-[17px]" />
        </button>
      </UTooltip>
    </template>
    <UTooltip v-if="a.url" text="Abrir link">
      <button class="hx-ib" aria-label="Abrir link" @click.stop="openUrl"><UIcon name="i-lucide-external-link" class="size-[17px]" /></button>
    </UTooltip>
    <span v-else-if="a.password" class="spacer" />
  </div>
  </UContextMenu>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px 9px 14px;
  border-top: 1px solid var(--hx-line);
  cursor: pointer;
  outline-offset: -2px;
}
.row:hover {
  background: var(--hx-bg);
}
.av {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
}
/* Low-chroma tints that work on every theme. */
.h1 { background: color-mix(in srgb, #9fb3cf 35%, var(--hx-surface)); color: color-mix(in srgb, #2e4a66 85%, var(--hx-ink)); }
.h2 { background: color-mix(in srgb, #b9a9da 35%, var(--hx-surface)); color: color-mix(in srgb, #4a3f73 85%, var(--hx-ink)); }
.h3 { background: color-mix(in srgb, #d7be8e 35%, var(--hx-surface)); color: color-mix(in srgb, #6a5328 85%, var(--hx-ink)); }
.h4 { background: color-mix(in srgb, #dba3a3 35%, var(--hx-surface)); color: color-mix(in srgb, #7a3b3b 85%, var(--hx-ink)); }
.h5 { background: color-mix(in srgb, #9fc9c4 35%, var(--hx-surface)); color: color-mix(in srgb, #2c5a55 85%, var(--hx-ink)); }
:global(.dark) .row .av { background: var(--hx-soft); color: var(--hx-soft-ink); }
.txt {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.t {
  font-weight: 600;
  font-size: 14.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.u {
  font-size: 13px;
  color: var(--hx-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 0;
  background: none;
  padding: 0;
  font-family: inherit;
  text-align: left;
  cursor: copy;
  max-width: 100%;
  align-self: flex-start;
}
.u:hover {
  color: var(--hx-ink);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.u.plain {
  cursor: inherit;
}
.u.plain:hover {
  text-decoration: none;
  color: var(--hx-muted);
}
.spacer {
  width: 32px;
  flex-shrink: 0;
}
</style>
