<script setup lang="ts">
import { computed, ref } from 'vue'
import { template } from '@shared/model'
import { api } from '../api'
import { useCopy } from '../copy'
import { dueLabel } from '../format'
import { preview } from '../markdown'
import { S, live } from '../store'

const term = ref('')
const { copy, fail } = useCopy()

function close(): void {
  S.search = false
  term.value = ''
}

const groups = computed(() => {
  if (!S.data) return []
  return [
    {
      id: 'accesses',
      label: 'Acessos',
      items: live(S.data.accesses).map((a) => ({
        label: a.title || 'Sem nome',
        suffix: a.username,
        keywords: [a.url.replace(/^https?:\/\//, ''), a.category, ...a.tags, a.notes].join(' '),
        icon: template(a.type).icon,
        kbds: a.password ? ['enter'] : undefined,
        onSelect: () => {
          close()
          if (a.password) copy(a.password, { key: a.id, secret: true, label: template(a.type).passwordLabel ?? 'Senha' }).catch(fail)
          else S.sheet = { kind: 'access', id: a.id }
        },
        a
      }))
    },
    {
      id: 'notes',
      label: 'Notas',
      items: live(S.data.notes).map((n) => ({
        label: n.title || 'Sem título',
        keywords: preview(n.body),
        icon: 'i-lucide-sticky-note',
        onSelect: () => {
          close()
          S.tab = 'notes'
          S.sheet = { kind: 'note', id: n.id }
        }
      }))
    },
    {
      id: 'tasks',
      label: 'Agenda',
      items: live(S.data.tasks).filter((t) => !t.done).map((t) => ({
        label: t.title,
        suffix: t.due ? dueLabel(t.due) : 'Sem data',
        icon: t.due ? 'i-lucide-bell' : 'i-lucide-circle',
        onSelect: () => {
          close()
          S.tab = 'agenda'
          S.sheet = { kind: 'task', id: t.id }
        }
      }))
    }
  ]
})
</script>

<template>
  <UModal :open="S.search" :ui="{ content: 'max-w-[calc(100%-28px)] sm:max-w-[calc(100%-28px)] top-[56px] translate-y-0 sm:top-[56px]' }" title="Buscar" description="Busca em acessos, notas e agenda" @update:open="(o) => !o && close()">
    <template #content>
      <UCommandPalette
        v-model:search-term="term"
        :groups="groups"
        placeholder="Buscar em acessos, notas e agenda"
        :fuse="{ fuseOptions: { keys: ['label', 'suffix', 'keywords'], threshold: 0.35, ignoreLocation: true }, resultLimit: 30 }"
        :close="{ 'aria-label': 'Fechar' }"
        class="max-h-[70vh]"
        @update:open="(o: boolean) => !o && close()"
      >
        <template #item-trailing="{ item }">
          <span v-if="(item as any).a" class="acts">
            <button v-if="(item as any).a.username" class="hx-ib small" aria-label="Copiar usuário" @click.stop="(close(), copy((item as any).a.username, { label: 'Usuário' }).catch(fail))">
              <UIcon name="i-lucide-user" class="size-4" />
            </button>
            <button v-if="(item as any).a.url" class="hx-ib small" aria-label="Abrir link" @click.stop="(close(), api('shell:open', (item as any).a.url).catch(fail))">
              <UIcon name="i-lucide-external-link" class="size-4" />
            </button>
          </span>
        </template>
        <template #footer>
          <div class="foot">
            <span><UKbd value="↑" /><UKbd value="↓" /> navegar</span>
            <span><UKbd value="Enter" /> copiar senha ou abrir</span>
            <span><UKbd value="Esc" /> fechar</span>
          </div>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>

<style scoped>
.acts {
  display: inline-flex;
  gap: 2px;
}
.small {
  width: 28px;
  height: 28px;
}
.foot {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--hx-muted);
  padding: 2px 4px;
  flex-wrap: wrap;
}
.foot span {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
</style>
