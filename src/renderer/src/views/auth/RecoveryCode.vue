<script setup lang="ts">
import { computed, ref } from 'vue'
import type { UnlockInfo } from '@shared/types'
import { enterVault } from '../../store'
import { useCopy } from '../../copy'
import AuthShell from './AuthShell.vue'

const props = defineProps<{ code: string; info?: UnlockInfo; step?: number }>()
const emit = defineEmits<{ done: [] }>()
const saved = ref(false)
const { copy } = useCopy()
const groups = computed(() => props.code.split('-'))

function print(): void {
  document.documentElement.classList.add('printing-code')
  window.print()
  document.documentElement.classList.remove('printing-code')
}

async function finish(): Promise<void> {
  if (props.info) await enterVault(props.info)
  emit('done')
}
</script>

<template>
  <AuthShell
    :step="step ?? (info ? 4 : undefined)"
    title="Guarde seu código de recuperação"
    lead="Se você esquecer a senha mestra ou perder o celular do 2FA, só este código devolve o acesso ao cofre. Ele aparece apenas agora."
  >
    <div class="code printable" aria-label="Código de recuperação">
      <span v-for="g in groups" :key="g" class="mono">{{ g }}</span>
    </div>
    <div class="row">
      <button class="hx-btn hx-soft" @click="copy(code, { label: 'Código', secret: true })"><UIcon name="i-lucide-copy" class="size-4" />Copiar</button>
      <button class="hx-btn hx-soft" @click="print"><UIcon name="i-lucide-printer" class="size-4" />Imprimir</button>
    </div>
    <div class="warn">
      <UIcon name="i-lucide-triangle-alert" class="size-[18px] shrink-0" />
      <span>Não salve o código no OneDrive junto com o cofre. Anote no papel ou guarde num lugar fora deste computador.</span>
    </div>
    <span class="grow" />
    <label class="ck">
      <input v-model="saved" type="checkbox" />
      <span>Guardei o código num lugar seguro e sei que, sem ele e sem a senha mestra, ninguém consegue abrir o cofre.</span>
    </label>
    <button class="hx-btn lg hx-primary" :disabled="!saved" @click="finish">{{ info ? 'Abrir meu cofre' : 'Pronto' }}</button>
  </AuthShell>
</template>

<style scoped>
.code {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.code span {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-align: center;
  background: var(--hx-surface);
  border: 1px solid var(--hx-line);
  border-radius: 10px;
  padding: 12px 0;
  user-select: text;
}
.row {
  display: flex;
  gap: 10px;
}
.row .hx-btn {
  flex: 1 1 0;
}
.warn {
  background: var(--hx-warn-soft);
  color: var(--hx-warn);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  font-size: 13.5px;
  line-height: 1.5;
  font-weight: 500;
}
.grow {
  flex-grow: 1;
}
.ck {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  font-size: 14px;
  line-height: 1.45;
  cursor: pointer;
}
.ck input {
  width: 20px;
  height: 20px;
  accent-color: var(--hx-primary);
  margin: 1px 0 0;
  flex-shrink: 0;
}
</style>

<style>
@media print {
  html.printing-code body * {
    visibility: hidden;
  }
  html.printing-code .printable,
  html.printing-code .printable * {
    visibility: visible;
  }
  html.printing-code .printable {
    position: fixed;
    top: 40px;
    left: 40px;
    right: 40px;
  }
}
</style>
