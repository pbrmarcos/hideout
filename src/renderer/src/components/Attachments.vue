<script setup lang="ts">
import { ref } from 'vue'
import type { AttachmentRef } from '@shared/types'
import { api } from '../api'
import { useCopy } from '../copy'

const list = defineModel<AttachmentRef[]>({ required: true })
const { fail } = useCopy()
const over = ref(false)

const size = (n: number): string => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`)

async function pick(): Promise<void> {
  try {
    list.value = [...list.value, ...(await api<AttachmentRef[]>('att:pick'))]
  } catch (e) {
    fail(e)
  }
}

async function drop(e: DragEvent): Promise<void> {
  over.value = false
  const files = [...(e.dataTransfer?.files ?? [])]
  if (!files.length) return
  try {
    const paths = files.map((f) => window.hideout.pathForFile(f)).filter(Boolean)
    list.value = [...list.value, ...(await api<AttachmentRef[]>('att:addPaths', paths))]
  } catch (err) {
    fail(err)
  }
}

const remove = (id: string): void => void (list.value = list.value.filter((a) => a.id !== id))
</script>

<template>
  <div class="hx-field">
    <span class="hx-label">Anexos</span>
    <div class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="drop">
      <div v-for="a in list" :key="a.id" class="att">
        <UIcon :name="a.mime.startsWith('image/') ? 'i-lucide-image' : a.mime === 'application/pdf' ? 'i-lucide-file-text' : 'i-lucide-file'" class="size-[17px] shrink-0" />
        <button type="button" class="name" :title="`Abrir ${a.name}`" @click="api('att:open', a.id, a.name).catch(fail)">{{ a.name }}</button>
        <span class="hx-hint">{{ size(a.size) }}</span>
        <button type="button" class="hx-ib" aria-label="Salvar uma cópia" @click="api('att:save', a.id, a.name).catch(fail)"><UIcon name="i-lucide-download" class="size-4" /></button>
        <button type="button" class="hx-ib" aria-label="Remover anexo" @click="remove(a.id)"><UIcon name="i-lucide-x" class="size-4" /></button>
      </div>
      <button type="button" class="add" @click="pick">
        <UIcon name="i-lucide-paperclip" class="size-4" />
        Arraste arquivos aqui ou clique para anexar (até 10 MB cada)
      </button>
    </div>
  </div>
</template>

<style scoped>
.drop {
  border: 1px dashed var(--hx-line);
  border-radius: 10px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: border-color 0.15s, background-color 0.15s;
}
.drop.over {
  border-color: var(--hx-primary);
  background: var(--hx-soft);
}
.att {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 4px 2px 8px;
  border-radius: 8px;
}
.att:hover {
  background: var(--hx-bg);
}
.name {
  flex-grow: 1;
  min-width: 0;
  text-align: left;
  border: 0;
  background: none;
  font: inherit;
  color: var(--hx-ink);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.name:hover {
  text-decoration: underline;
}
.add {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--hx-muted);
  padding: 8px;
  cursor: pointer;
  border-radius: 8px;
  text-align: left;
}
.add:hover {
  color: var(--hx-ink);
  background: var(--hx-bg);
}
</style>
