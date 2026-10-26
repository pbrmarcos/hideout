<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@shared/model'
import { NOTE_COLORS } from '../format'
import { S, createCategory, live, updateCategory } from '../store'

const name = ref('')
const icon = ref(CATEGORY_ICONS[0])
const color = ref('sage')
const error = ref('')

const editing = computed(() => (S.categoryDialog?.id ? S.data?.categories.find((c) => c.id === S.categoryDialog!.id) ?? null : null))
const count = computed(() => (editing.value ? live(S.data!.accesses).filter((a) => a.category === editing.value!.name).length : 0))
const colors = NOTE_COLORS.filter((c) => CATEGORY_COLORS.includes(c.id))

watch(
  () => S.categoryDialog,
  (d) => {
    if (!d) return
    error.value = ''
    name.value = editing.value?.name ?? ''
    icon.value = editing.value?.icon ?? CATEGORY_ICONS[0]
    color.value = editing.value?.color ?? 'sage'
  }
)

function save(): void {
  const clean = name.value.trim()
  if (!clean) return
  if (editing.value) {
    const err = updateCategory(editing.value.id, { name: clean, icon: icon.value, color: color.value })
    if (err) return void (error.value = err)
  } else {
    const before = S.data!.categories.length
    const c = createCategory(clean, icon.value, color.value)
    if (c && S.data!.categories.length === before) return void (error.value = 'Já existe uma categoria com esse nome.')
  }
  S.categoryDialog = null
}
</script>

<template>
  <UModal
    :open="!!S.categoryDialog"
    :title="editing ? 'Editar categoria' : 'Nova categoria'"
    :description="editing && count ? `${count} ${count === 1 ? 'acesso' : 'acessos'} nesta categoria. Renomear muda todos.` : 'Agrupe seus acessos do jeito que fizer sentido para você.'"
    :close="{ 'aria-label': 'Fechar' }"
    @update:open="(o) => !o && (S.categoryDialog = null)"
  >
    <template #body>
      <form class="form" @submit.prevent="save">
        <div class="hx-field">
          <label class="hx-label" for="cat-name">Nome</label>
          <div class="hx-in">
            <input id="cat-name" v-model="name" maxlength="40" autofocus placeholder="Ex.: Trabalho, Bancos, Streaming" />
          </div>
          <p v-if="error" class="hx-error" role="alert">{{ error }}</p>
        </div>
        <div class="hx-field">
          <span class="hx-label">Ícone</span>
          <div class="icons" role="radiogroup" aria-label="Ícone">
            <button
              v-for="i in CATEGORY_ICONS"
              :key="i"
              type="button"
              role="radio"
              :aria-checked="icon === i"
              :aria-label="i.replace('i-lucide-', '')"
              class="ic"
              :class="{ on: icon === i }"
              @click="icon = i"
            >
              <UIcon :name="i" class="size-[18px]" />
            </button>
          </div>
        </div>
        <div class="hx-field">
          <span class="hx-label">Cor</span>
          <div class="colors" role="radiogroup" aria-label="Cor">
            <button
              v-for="c in colors"
              :key="c.id"
              type="button"
              role="radio"
              :aria-checked="color === c.id"
              :aria-label="c.label"
              class="c"
              :class="{ on: color === c.id }"
              :style="{ background: c.hex }"
              @click="color = c.id"
            />
          </div>
        </div>
        <div class="foot">
          <button type="button" class="hx-btn hx-ghost" @click="S.categoryDialog = null">Cancelar</button>
          <button class="hx-btn hx-primary" :disabled="!name.trim()">{{ editing ? 'Salvar' : 'Criar categoria' }}</button>
        </div>
      </form>
    </template>
  </UModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 6px;
}
.ic {
  height: 40px;
  border-radius: 10px;
  border: 0;
  background: var(--hx-bg);
  color: var(--hx-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.ic:hover {
  background: var(--hx-line);
}
.ic.on {
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
  box-shadow: inset 0 0 0 2px var(--hx-primary);
}
.colors {
  display: flex;
  gap: 10px;
}
.c {
  width: 28px;
  height: 28px;
  border-radius: 14px;
  border: 0;
  cursor: pointer;
}
.c.on {
  box-shadow: 0 0 0 2px var(--hx-surface), 0 0 0 4px var(--hx-ink);
}
.foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
