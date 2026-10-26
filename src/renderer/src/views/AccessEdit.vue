<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { newAccess, template, uid } from '@shared/model'
import type { Access, ItemType } from '@shared/types'
import { api } from '../api'
import { useCopy } from '../copy'
import { locale, t } from '../i18n'
import { S, catName, categories, trash, upsertAccess } from '../store'
import Attachments from '../components/Attachments.vue'
import PasswordGenerator from '../components/PasswordGenerator.vue'
import QrCode from '../components/QrCode.vue'
import Sheet from '../components/Sheet.vue'

const props = defineProps<{ id: string | null; type?: ItemType; category?: string }>()
const { copy, fail, info } = useCopy()

const original = props.id ? S.data!.accesses.find((a) => a.id === props.id) : null
const a = reactive<Access>(original ? (JSON.parse(JSON.stringify(original)) as Access) : newAccess(props.type ?? 'login', props.category ?? 'Geral'))
const isNew = !original
const tpl = computed(() => template(a.type))
const showPw = ref(isNew)
const showGen = ref(isNew && a.type === 'login')
const showHistory = ref(false)
const revealed = reactive<Record<string, boolean>>({})

const categoryItems = ref(categories().length ? categories() : ['Geral'])
function onCreateCategory(c: string): void {
  categoryItems.value.push(c)
  a.category = c
}

const wifiQr = computed(() => {
  if (a.type !== 'wifi' || !a.username) return ''
  const esc = (s: string): string => s.replace(/([\\;,:"])/g, '\\$1')
  const sec = a.fields.find((f) => f.label === 'Segurança')?.value || 'WPA'
  return `WIFI:T:${a.password ? esc(sec) : 'nopass'};S:${esc(a.username)};P:${esc(a.password)};;`
})

const valid = computed(() => a.title.trim().length > 0 || (a.type !== 'login' && a.username.trim().length > 0))

function addField(): void {
  a.fields.push({ id: uid(), label: '', value: '', secret: false })
}

function save(): void {
  if (!valid.value) return
  upsertAccess({ ...a, title: a.title.trim() || a.username.trim(), category: a.category.trim() || 'Geral' })
  S.sheet = null
}

function remove(): void {
  if (!original) return
  trash('accesses', original.id)
  info(t('Movido para a lixeira'), t('Fica lá por 30 dias. Recupere em Configurações.'))
  S.sheet = null
}

const fmtDate = (iso: string): string => new Date(iso).toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' })
</script>

<template>
  <Sheet :title="isNew ? t('Novo: {type}', { type: t(tpl.label).toLowerCase() }) : a.title || t(tpl.label)" back @close="S.sheet = null">
    <template #actions>
      <UTooltip :text="a.favorite ? t('Tirar dos favoritos') : t('Mostrar em Favoritos')">
        <button class="hx-ib" :class="{ fav: a.favorite }" :aria-pressed="a.favorite" :aria-label="t('Favorito')" @click="a.favorite = !a.favorite">
          <UIcon :name="a.favorite ? 'i-lucide-star' : 'i-lucide-star'" class="size-[18px]" />
        </button>
      </UTooltip>
    </template>

    <form class="form" @submit.prevent="save">
      <div class="hx-field">
        <label class="hx-label" for="ae-title">{{ t('Nome') }}</label>
        <div class="hx-in"><input id="ae-title" v-model="a.title" :placeholder="tpl.type === 'login' ? t('Ex.: Gmail, Banco, Painel do site') : t(tpl.label)" autofocus /></div>
      </div>

      <div v-if="tpl.hasUrl" class="hx-field">
        <label class="hx-label" for="ae-url">{{ t('Link') }}</label>
        <div class="hx-in">
          <input id="ae-url" v-model="a.url" placeholder="https://" spellcheck="false" />
          <button v-if="a.url" type="button" class="hx-ib" :aria-label="t('Abrir link')" @click="api('shell:open', a.url).catch(fail)"><UIcon name="i-lucide-external-link" class="size-4" /></button>
        </div>
      </div>

      <div class="two">
        <div v-if="tpl.usernameLabel" class="hx-field">
          <label class="hx-label" for="ae-user">{{ t(tpl.usernameLabel!) }}</label>
          <div class="hx-in">
            <input id="ae-user" v-model="a.username" spellcheck="false" />
            <button v-if="a.username" type="button" class="hx-ib" :aria-label="t('Copiar {what}', { what: t(tpl.usernameLabel!) })" @click="copy(a.username, { label: t(tpl.usernameLabel!) })"><UIcon name="i-lucide-copy" class="size-4" /></button>
          </div>
        </div>
        <div class="hx-field">
          <label class="hx-label" for="ae-cat">{{ t('Categoria') }}</label>
          <UInputMenu
            id="ae-cat"
            v-model="a.category"
            :items="categoryItems"
            create-item
            :placeholder="catName('Geral')"
            :ui="{ base: 'h-10 rounded-[10px]' }"
            @create="onCreateCategory"
          />
        </div>
      </div>

      <div v-if="tpl.passwordLabel" class="hx-field">
        <label class="hx-label" for="ae-pw">{{ t(tpl.passwordLabel!) }}</label>
        <div class="hx-in">
          <input id="ae-pw" v-model="a.password" :type="showPw ? 'text' : 'password'" class="mono" spellcheck="false" autocomplete="off" />
          <button type="button" class="hx-ib" :aria-label="showPw ? t('Ocultar') : t('Mostrar')" @click="showPw = !showPw"><UIcon :name="showPw ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-4" /></button>
          <button v-if="a.password" type="button" class="hx-ib" :aria-label="t('Copiar')" @click="copy(a.password, { label: t(tpl.passwordLabel!), secret: true, key: a.id })"><UIcon name="i-lucide-copy" class="size-4" /></button>
          <UTooltip v-if="a.type !== 'card'" :text="t('Gerar senha')">
            <button type="button" class="hx-ib" :class="{ on: showGen }" :aria-label="t('Gerar senha')" @click="showGen = !showGen"><UIcon name="i-lucide-wand-sparkles" class="size-4" /></button>
          </UTooltip>
        </div>
        <PasswordGenerator v-if="showGen" v-model="a.password" @use="(p) => ((a.password = p), (showPw = true))" />
      </div>

      <div v-if="wifiQr" class="wifi">
        <QrCode :value="wifiQr" :size="120" :label="t('QR Code para conectar ao Wi-Fi {name}', { name: a.username })" />
        <span class="hx-hint">{{ t('Aponte a câmera do celular para conectar sem digitar a senha.') }}</span>
      </div>

      <div v-for="(f, i) in a.fields" :key="f.id" class="hx-field">
        <div class="flabel">
          <input v-model="f.label" class="label-in" :placeholder="t('Nome do campo')" :aria-label="t('Nome do campo {n}', { n: i + 1 })" />
          <UTooltip :text="f.secret ? t('Campo secreto: fica oculto') : t('Marcar como secreto')">
            <button type="button" class="mini" :class="{ on: f.secret }" :aria-pressed="f.secret" :aria-label="t('Secreto')" @click="f.secret = !f.secret">
              <UIcon :name="f.secret ? 'i-lucide-lock' : 'i-lucide-lock-open'" class="size-3" /><template v-if="f.secret">{{ t('Secreto') }}</template>
            </button>
          </UTooltip>
          <button type="button" class="mini" :aria-label="t('Remover campo')" @click="a.fields.splice(i, 1)"><UIcon name="i-lucide-x" class="size-3" /></button>
        </div>
        <div class="hx-in">
          <input v-model="f.value" :type="f.secret && !revealed[f.id] ? 'password' : 'text'" :class="{ mono: f.secret }" spellcheck="false" :aria-label="f.label ? t(f.label) : t('Valor')" />
          <button v-if="f.secret" type="button" class="hx-ib" :aria-label="revealed[f.id] ? t('Ocultar') : t('Mostrar')" @click="revealed[f.id] = !revealed[f.id]"><UIcon :name="revealed[f.id] ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-4" /></button>
          <button v-if="f.value" type="button" class="hx-ib" :aria-label="t('Copiar')" @click="copy(f.value, { label: f.label ? t(f.label) : t('Campo'), secret: f.secret, key: f.secret ? f.id : undefined })"><UIcon name="i-lucide-copy" class="size-4" /></button>
        </div>
      </div>
      <button type="button" class="hx-link add" @click="addField"><UIcon name="i-lucide-plus" class="size-4" />{{ t('Adicionar campo (PIN, pergunta de segurança, chave Pix…)') }}</button>

      <div class="hx-field">
        <span class="hx-label">{{ t('Etiquetas') }}</span>
        <UInputTags v-model="a.tags" :placeholder="t('Adicionar')" :ui="{ root: 'min-h-10 rounded-[10px]' }" />
      </div>

      <div class="hx-field">
        <label class="hx-label" for="ae-notes">{{ t('Observações') }}</label>
        <div class="hx-in"><textarea id="ae-notes" v-model="a.notes" rows="3" /></div>
      </div>

      <Attachments v-model="a.attachments" />

      <div v-if="a.history.length" class="hx-field">
        <button type="button" class="hx-link add" @click="showHistory = !showHistory">
          <UIcon name="i-lucide-history" class="size-4" />{{ t('Senhas anteriores ({n})', { n: a.history.length }) }}
        </button>
        <div v-if="showHistory" class="history">
          <div v-for="h in a.history" :key="h.changedAt" class="hrow">
            <span class="hx-hint">{{ t('até {date}', { date: fmtDate(h.changedAt) }) }}</span>
            <span class="grow" />
            <button type="button" class="hx-btn hx-soft sm" @click="copy(h.password, { label: t('Senha anterior'), secret: true })"><UIcon name="i-lucide-copy" class="size-4" />{{ t('Copiar') }}</button>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <button v-if="!isNew" class="hx-btn hx-danger" @click="remove"><UIcon name="i-lucide-trash-2" class="size-4" />{{ t('Excluir') }}</button>
      <span class="grow" />
      <button class="hx-btn hx-ghost" @click="S.sheet = null">{{ t('Cancelar') }}</button>
      <button class="hx-btn hx-primary" :disabled="!valid" @click="save">{{ t('Salvar') }}</button>
    </template>
  </Sheet>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}
.grow {
  flex-grow: 1;
}
.fav {
  color: var(--hx-warn);
}
.on {
  color: var(--hx-primary);
}
.wifi {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--hx-bg);
  border-radius: 12px;
  padding: 12px;
}
.flabel {
  display: flex;
  align-items: center;
  gap: 6px;
}
.label-in {
  flex-grow: 1;
  border: 0;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--hx-ink);
  outline: 0;
  padding: 2px 0;
  border-bottom: 1px dashed transparent;
}
.label-in:focus {
  border-bottom-color: var(--hx-line);
}
.mini {
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--hx-line);
  background: var(--hx-surface);
  font: inherit;
  font-size: 12px;
  color: var(--hx-muted);
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.mini.on {
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
  border-color: var(--hx-primary);
}
.add {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-left: 0;
  text-decoration: none;
}
.history {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hrow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sm {
  height: 30px;
  font-size: 13px;
}
</style>
