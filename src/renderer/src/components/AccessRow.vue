<script setup lang="ts">
import { computed, ref } from 'vue'
import { template } from '@shared/model'
import type { Access } from '@shared/types'
import { api } from '../api'
import { useCopy } from '../copy'
import { t } from '../i18n'
import { S, catName, categoryList, markUsed, moveAccess, trash, upsertAccess } from '../store'
import PasswordSeal from './PasswordSeal.vue'

const props = defineProps<{ a: Access; before?: boolean }>()
const emit = defineEmits<{ dragstart: []; dragover: [e: DragEvent]; drop: [] }>()
const shown = ref(false)
const { copy, fail } = useCopy()

const HUES = 6
const hue = computed(() => {
  let h = 0
  for (const ch of props.a.title) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % HUES
})
const tpl = computed(() => template(props.a.type))
const userLabel = computed(() => t(tpl.value.usernameLabel ?? 'Usuário'))
const passLabel = computed(() => t(tpl.value.passwordLabel ?? 'Senha'))
const subtitle = computed(() => props.a.username || (props.a.url ? props.a.url.replace(/^https?:\/\//, '') : t(tpl.value.label)))

function open(): void {
  S.sheet = { kind: 'access', id: props.a.id }
}
function copyPassword(): void {
  copy(props.a.password, { key: props.a.id, secret: true, label: passLabel.value }).then(() => markUsed(props.a.id), fail)
}
function copyUser(): void {
  copy(props.a.username, { label: userLabel.value }).then(() => markUsed(props.a.id), fail)
}
function openUrl(): void {
  api('shell:open', props.a.url).then(() => markUsed(props.a.id), fail)
}

const menu = computed(() => [
  [
    { label: t('Editar'), icon: 'i-lucide-pencil', onSelect: open },
    ...(props.a.password ? [{ label: t('Copiar {what}', { what: passLabel.value.toLowerCase() }), icon: 'i-lucide-key-round', onSelect: copyPassword }] : []),
    ...(props.a.username ? [{ label: t('Copiar {what}', { what: userLabel.value.toLowerCase() }), icon: 'i-lucide-user', onSelect: copyUser }] : []),
    ...(props.a.url ? [{ label: t('Abrir link'), icon: 'i-lucide-external-link', onSelect: openUrl }] : [])
  ],
  [
    {
      label: t('Mover para'),
      icon: 'i-lucide-folder-input',
      children: [
        categoryList().map((c) => ({ label: catName(c.name), icon: c.icon, disabled: c.name === props.a.category, onSelect: () => moveAccess(props.a.id, c.name) })),
        [{ label: t('Nova categoria…'), icon: 'i-lucide-folder-plus', onSelect: () => (S.categoryDialog = { id: null }) }]
      ]
    },
    {
      label: props.a.favorite ? t('Tirar dos favoritos') : t('Adicionar aos favoritos'),
      icon: 'i-lucide-star',
      onSelect: () => upsertAccess({ ...props.a, favorite: !props.a.favorite })
    }
  ],
  [{ label: t('Excluir'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => trash('accesses', props.a.id) }]
])

function onDragStart(e: DragEvent): void {
  e.dataTransfer?.setData('text/plain', props.a.title)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  emit('dragstart')
}
</script>

<template>
  <UContextMenu :items="menu">
    <div
      class="row"
      :class="{ before }"
      draggable="true"
      tabindex="0"
      :aria-label="t('Abrir {name}', { name: a.title })"
      @dragstart="onDragStart"
      @dragover="emit('dragover', $event)"
      @drop.prevent.stop="emit('drop')"
      @click="open"
      @keydown.enter.self="open"
    >
      <div class="av" :class="`h${hue}`" aria-hidden="true">
        <UIcon v-if="a.type !== 'login'" :name="tpl.icon" class="size-[17px]" />
        <template v-else>{{ (a.title || '?')[0].toUpperCase() }}</template>
      </div>
      <div class="txt">
        <span class="t">{{ a.title || t('Sem nome') }}</span>
        <button v-if="a.username" class="u" :title="t('Copiar {what}', { what: userLabel.toLowerCase() })" @click.stop="copyUser">{{ subtitle }}</button>
        <span v-else class="u plain">{{ subtitle }}</span>
      </div>
      <template v-if="a.password">
        <PasswordSeal :copy-key="a.id" :value="a.password" :shown="shown" :label="passLabel.toLowerCase()" @copy="copyPassword" />
        <UTooltip :text="shown ? t('Ocultar') : t('Mostrar')">
          <button class="hx-ib" :aria-label="shown ? t('Ocultar senha') : t('Mostrar senha')" @click.stop="shown = !shown">
            <UIcon :name="shown ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-[17px]" />
          </button>
        </UTooltip>
      </template>
      <UTooltip v-if="a.url" :text="t('Abrir link')">
        <button class="hx-ib" :aria-label="t('Abrir link')" @click.stop="openUrl"><UIcon name="i-lucide-external-link" class="size-[17px]" /></button>
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
.row.before {
  box-shadow: inset 0 3px 0 var(--hx-primary);
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
