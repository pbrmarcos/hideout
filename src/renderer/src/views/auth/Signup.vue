<script setup lang="ts">
import { computed, ref } from 'vue'
import { normalizeUser } from '@shared/model'
import type { SignupStart } from '@shared/types'
import { api, ApiError } from '../../api'
import { t } from '../../i18n'
import { S } from '../../store'
import StrengthMeter from '../../components/StrengthMeter.vue'
import AuthShell from './AuthShell.vue'

const user = ref('')
const pw = ref('')
const pw2 = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref('')

const slug = computed(() => normalizeUser(user.value))
const matches = computed(() => pw2.value.length > 0 && pw.value === pw2.value)
const valid = computed(() => !!slug.value && pw.value.length >= 12 && matches.value)
const folder = computed(() => S.app?.settings.vaultDir ?? '')

async function submit(): Promise<void> {
  if (!valid.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const r = await api<SignupStart>('signup:begin', user.value, pw.value)
    S.auth = { name: 'totp', otpauth: r.otpauth, secret: r.secret, mode: 'signup' }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('Não foi possível criar a conta.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthShell logo :step="1" :title="t('Crie sua conta')" :lead="t('A senha mestra tranca o cofre inteiro. Nem o Hideout nem a Microsoft conseguem ver o que tem dentro.')">
    <form class="form" @submit.prevent="submit">
      <div class="hx-field">
        <label class="hx-label" for="su-user">{{ t('Usuário') }}</label>
        <div class="hx-in lg"><input id="su-user" v-model="user" autocomplete="username" autofocus spellcheck="false" /></div>
        <span v-if="slug" class="hx-hint">{{ t('O cofre fica em {path}', { path: `${folder}\\${slug}.vault` }) }}</span>
      </div>
      <div class="hx-field">
        <label class="hx-label" for="su-pw">{{ t('Senha mestra') }}</label>
        <div class="hx-in lg">
          <input id="su-pw" v-model="pw" :type="show ? 'text' : 'password'" autocomplete="new-password" />
          <button type="button" class="hx-ib" :aria-label="show ? t('Ocultar senha') : t('Mostrar senha')" @click="show = !show">
            <UIcon :name="show ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-[17px]" />
          </button>
        </div>
        <StrengthMeter :value="pw" />
        <span class="hx-hint">{{ t('Dica: 4 ou mais palavras soltas são fáceis de lembrar e difíceis de adivinhar. Mínimo de 12 caracteres.') }}</span>
      </div>
      <div class="hx-field">
        <label class="hx-label" for="su-pw2">{{ t('Repita a senha mestra') }}</label>
        <div class="hx-in lg"><input id="su-pw2" v-model="pw2" :type="show ? 'text' : 'password'" autocomplete="new-password" /></div>
        <span v-if="matches" class="ok"><UIcon name="i-lucide-check" class="size-[14px]" />{{ t('As senhas conferem') }}</span>
        <span v-else-if="pw2 && pw2.length >= pw.length" class="hx-error">{{ t('As senhas não conferem') }}</span>
      </div>
      <p v-if="error" class="hx-error" role="alert"><UIcon name="i-lucide-circle-alert" class="size-[15px]" />{{ error }}</p>
      <span class="grow" />
      <button class="hx-btn lg hx-primary" type="submit" :disabled="!valid || busy">{{ busy ? t('Protegendo o cofre…') : t('Continuar') }}</button>
      <p class="alt">{{ t('Já tem conta nesta pasta?') }} <button type="button" class="hx-link" @click="S.auth = { name: 'login' }">{{ t('Entrar') }}</button></p>
    </form>
  </AuthShell>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex-grow: 1;
}
.grow {
  flex-grow: 1;
}
.ok {
  font-size: 12.5px;
  color: var(--hx-soft-ink);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.alt {
  margin: 0;
  text-align: center;
  font-size: 14px;
  color: var(--hx-muted);
}
</style>
