<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  COLOR_KEYS, THEMES, completeTheme, contrast, customFrom, normalizeHex, parseThemeCode, themeById, themeToCode, type ColorKey, type CustomId
} from '@shared/themes'
import type { CustomTheme } from '@shared/types'
import { ApiError } from '../api'
import { useCopy } from '../copy'
import { t } from '../i18n'
import { S, saveCustomTheme, setTheme } from '../store'
import { paint } from '../theme'
import Sheet from '../components/Sheet.vue'

const props = defineProps<{ id: CustomId }>()
const { copy, fail, info } = useCopy()

const slotNumber = props.id.slice(-1)
const saved = S.app!.settings.customThemes[props.id]
const draft = reactive<CustomTheme>(saved ? { ...saved } : customFrom(themeById(S.theme, S.app!.settings.customThemes), t('Personalizado {n}', { n: slotNumber })))
const previous = S.theme
let committed = false

// Live preview on the whole app while editing.
watch(draft, () => paint(completeTheme(props.id, draft)), { deep: true, immediate: true })
onBeforeUnmount(() => {
  if (!committed) setTheme(previous, false)
})

const LABELS: Record<ColorKey, [string, string]> = {
  bg: ['Fundo', 'Fundo da janela, atrás de tudo'],
  surface: ['Superfície', 'Listas, painéis e campos'],
  ink: ['Texto', 'Texto principal'],
  muted: ['Texto secundário', 'Descrições, datas e dicas'],
  line: ['Linhas', 'Bordas e divisórias'],
  primary: ['Destaque', 'Botões principais e seleção'],
  onPrimary: ['Texto no destaque', 'Texto e ícones sobre o destaque'],
  soft: ['Destaque suave', 'Selo da senha e itens marcados'],
  softInk: ['Texto no destaque suave', 'Texto sobre o destaque suave'],
  warn: ['Aviso', 'Atrasados e alertas'],
  danger: ['Perigo', 'Excluir e erros']
}

const checks = computed(() => [
  { label: t('Texto sobre a superfície'), r: contrast(draft.ink, draft.surface), min: 4.5 },
  { label: t('Texto sobre o fundo'), r: contrast(draft.ink, draft.bg), min: 4.5 },
  { label: t('Texto secundário'), r: contrast(draft.muted, draft.surface), min: 4.5 },
  { label: t('Texto no destaque'), r: contrast(draft.onPrimary, draft.primary), min: 4.5 },
  { label: t('Texto no destaque suave'), r: contrast(draft.softInk, draft.soft), min: 4.5 },
  { label: t('Destaque sobre a superfície'), r: contrast(draft.primary, draft.surface), min: 3 }
])
const weak = computed(() => checks.value.filter((c) => c.r < c.min))

function setHex(key: ColorKey, value: string): void {
  const hex = normalizeHex(value)
  if (hex) draft[key] = hex
}

const presets = computed(() => [
  THEMES.map((th) => ({ label: th.name, onSelect: () => Object.assign(draft, customFrom(th, draft.name)) }))
])

// --- code in / out --------------------------------------------------------------------
const pasting = ref(false)
const pasted = ref('')

function aiPrompt(): string {
  return [
    t('Crie um tema de cores para o app Hideout (gerenciador de senhas para Windows).'),
    t('O estilo que eu quero: [descreva aqui, por exemplo: azul petróleo calmo, modo escuro].'),
    '',
    t('Regras: o texto (ink) precisa ter contraste de pelo menos 4.5:1 sobre bg e surface; onPrimary precisa ser legível sobre primary; softInk precisa ser legível sobre soft. Use cores em hexadecimal (#RRGGBB).'),
    t('O que cada cor faz:'),
    ...COLOR_KEYS.map((k) => `- ${k}: ${t(LABELS[k][1])}`),
    `- dark: ${t('yes se o fundo for escuro')}`,
    `- mono: ${t('yes para usar fonte de terminal')}`,
    '',
    t('Responda só com este bloco, trocando os valores:'),
    '',
    themeToCode(draft)
  ].join('\n')
}

async function copyPrompt(): Promise<void> {
  await copy(aiPrompt(), { label: t('Pedido para a IA') }).catch(fail)
}
async function copyCode(): Promise<void> {
  await copy(themeToCode(draft), { label: t('Código do tema') }).catch(fail)
}
function applyPasted(): void {
  const { theme, read, errors } = parseThemeCode(pasted.value, draft)
  if (!read) return fail(new ApiError(t('Não encontrei cores nesse texto. Cole o bloco que começa com "# Hideout theme".')))
  Object.assign(draft, theme)
  pasting.value = false
  pasted.value = ''
  info(t('Cores aplicadas'), errors.length ? t('Ignorei valores que não são cores: {list}', { list: errors.join(', ') }) : t('{n} valores lidos.', { n: read }))
}

async function save(): Promise<void> {
  try {
    await saveCustomTheme(props.id, { ...draft, name: draft.name.trim() || t('Personalizado {n}', { n: slotNumber }) })
    committed = true
    info(t('Tema salvo'))
    S.sheet = { kind: 'settings' }
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <Sheet :title="t('Editar tema personalizado {n}', { n: slotNumber })" back @close="S.sheet = { kind: 'settings' }">
    <div class="hx-field">
      <label class="hx-label" for="th-name">{{ t('Nome do tema') }}</label>
      <div class="hx-in"><input id="th-name" v-model="draft.name" maxlength="30" /></div>
    </div>

    <div class="tools">
      <UDropdownMenu :items="presets">
        <button class="hx-btn hx-soft sm"><UIcon name="i-lucide-palette" class="size-4" />{{ t('Começar de um tema') }}</button>
      </UDropdownMenu>
      <button class="hx-btn hx-soft sm" @click="copyPrompt"><UIcon name="i-lucide-sparkles" class="size-4" />{{ t('Copiar pedido para IA') }}</button>
      <button class="hx-btn hx-soft sm" @click="pasting = !pasting"><UIcon name="i-lucide-clipboard-paste" class="size-4" />{{ t('Colar cores') }}</button>
      <button class="hx-btn hx-ghost sm" @click="copyCode"><UIcon name="i-lucide-code" class="size-4" />{{ t('Copiar código') }}</button>
    </div>

    <div v-if="pasting" class="paste">
      <p class="hx-hint">
        {{ t('Cole aqui a resposta da IA (ou um código de tema copiado). Pode colar o texto inteiro: o Hideout acha as cores sozinho.') }}
      </p>
      <div class="hx-in"><textarea v-model="pasted" rows="7" class="mono" :aria-label="t('Código do tema')" placeholder="# Hideout theme&#10;bg: #EDF1EC&#10;..." /></div>
      <div class="row-end">
        <button class="hx-btn hx-ghost sm" @click="pasting = false">{{ t('Cancelar') }}</button>
        <button class="hx-btn hx-primary sm" :disabled="!pasted.trim()" @click="applyPasted">{{ t('Aplicar cores') }}</button>
      </div>
    </div>

    <div class="colors">
      <div v-for="k in COLOR_KEYS" :key="k" class="color">
        <label class="swatch" :style="{ background: draft[k] }">
          <input type="color" :value="draft[k]" :aria-label="t(LABELS[k][0])" @input="setHex(k, ($event.target as HTMLInputElement).value)" />
        </label>
        <span class="lbl"><b>{{ t(LABELS[k][0]) }}</b><span>{{ t(LABELS[k][1]) }}</span></span>
        <input class="hex mono" :value="draft[k]" spellcheck="false" maxlength="7" :aria-label="t('{name} em hexadecimal', { name: t(LABELS[k][0]) })" @change="setHex(k, ($event.target as HTMLInputElement).value)" />
      </div>
    </div>

    <label class="toggle"><USwitch v-model="draft.dark" />{{ t('Tema escuro (ajusta menus e campos do sistema)') }}</label>
    <label class="toggle"><USwitch v-model="draft.mono" />{{ t('Fonte de terminal (monoespaçada)') }}</label>

    <div class="checks" :class="{ bad: weak.length }">
      <b>{{ weak.length ? t('Algumas combinações estão difíceis de ler') : t('Contraste bom em tudo') }}</b>
      <div v-for="c in checks" :key="c.label" class="check">
        <UIcon :name="c.r >= c.min ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'" class="size-4 shrink-0" />
        <span>{{ c.label }}</span>
        <span class="ratio">{{ c.r.toFixed(1) }}:1</span>
      </div>
      <span class="hx-hint">{{ t('O mínimo recomendado para texto é 4.5:1.') }}</span>
    </div>

    <template #footer>
      <span class="hx-hint">{{ t('A prévia já está aplicada no app.') }}</span>
      <span class="grow" />
      <button class="hx-btn hx-ghost" @click="S.sheet = { kind: 'settings' }">{{ t('Cancelar') }}</button>
      <button class="hx-btn hx-primary" @click="save">{{ t('Salvar tema') }}</button>
    </template>
  </Sheet>
</template>

<style scoped>
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sm {
  height: 34px;
  font-size: 13px;
  padding: 0 12px;
}
.paste {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--hx-bg);
  border-radius: 12px;
  padding: 12px;
}
.paste textarea {
  font-size: 12.5px;
}
.row-end {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.colors {
  display: flex;
  flex-direction: column;
}
.color {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--hx-line);
}
.swatch {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.15);
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}
.swatch input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.lbl {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.lbl b {
  font-size: 14px;
}
.lbl span {
  font-size: 12.5px;
  color: var(--hx-muted);
}
.hex {
  width: 92px;
  height: 32px;
  border: 1px solid var(--hx-line);
  border-radius: 8px;
  background: var(--hx-surface);
  color: var(--hx-ink);
  font-size: 13px;
  padding: 0 8px;
  text-transform: uppercase;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  cursor: pointer;
}
.checks {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
  border-radius: 12px;
  padding: 12px 14px;
}
.checks.bad {
  background: var(--hx-warn-soft);
  color: var(--hx-warn);
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.ratio {
  margin-left: auto;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.grow {
  flex-grow: 1;
}
</style>
