<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SignupStart } from '@shared/types'
import { api, ApiError } from '../../api'
import { t } from '../../i18n'
import { S } from '../../store'
import StrengthMeter from '../../components/StrengthMeter.vue'
import AuthShell from './AuthShell.vue'

const props = defineProps<{ step: 'code' | 'password'; user?: string }>()
const user = ref(props.user ?? '')
const code = ref('')
const pw = ref('')
const pw2 = ref('')
const busy = ref(false)
const error = ref('')
const valid = computed(() => (props.step === 'code' ? !!user.value && code.value.replace(/\W/g, '').length >= 24 : pw.value.length >= 12 && pw.value === pw2.value))

async function submit(): Promise<void> {
  if (!valid.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (props.step === 'code') {
      await api('recover:begin', user.value, code.value)
      S.auth = { name: 'recover-password' }
    } else {
      const r = await api<SignupStart>('recover:password', pw.value)
      S.auth = { name: 'totp', otpauth: r.otpauth, secret: r.secret, mode: 'recover' }
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('Não deu certo. Confira e tente de novo.')
  } finally {
    busy.value = false
  }
}

async function back(): Promise<void> {
  await api('pending:cancel')
  S.auth = { name: 'login', user: user.value || undefined }
}
</script>

<template>
  <AuthShell
    logo
    :title="step === 'code' ? t('Recuperar acesso') : t('Crie uma nova senha mestra')"
    :lead="step === 'code' ? t('Use o código de recuperação de 24 caracteres que você guardou no cadastro.') : t('Depois disso você vai cadastrar o 2FA de novo e criar um PIN.')"
  >
    <form class="form" @submit.prevent="submit">
      <template v-if="step === 'code'">
        <div class="hx-field">
          <label class="hx-label" for="rc-user">{{ t('Usuário') }}</label>
          <div class="hx-in lg"><input id="rc-user" v-model="user" spellcheck="false" :autofocus="!user" /></div>
        </div>
        <div class="hx-field">
          <label class="hx-label" for="rc-code">{{ t('Código de recuperação') }}</label>
          <div class="hx-in lg"><input id="rc-code" v-model="code" class="mono" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" spellcheck="false" autocomplete="off" :autofocus="!!user" /></div>
          <span class="hx-hint">{{ t('Hífens e letras minúsculas não fazem diferença.') }}</span>
        </div>
      </template>
      <template v-else>
        <div class="hx-field">
          <label class="hx-label" for="rc-pw">{{ t('Nova senha mestra') }}</label>
          <div class="hx-in lg"><input id="rc-pw" v-model="pw" type="password" autocomplete="new-password" autofocus /></div>
          <StrengthMeter :value="pw" />
        </div>
        <div class="hx-field">
          <label class="hx-label" for="rc-pw2">{{ t('Repita a nova senha') }}</label>
          <div class="hx-in lg"><input id="rc-pw2" v-model="pw2" type="password" autocomplete="new-password" /></div>
        </div>
      </template>
      <p v-if="error" class="hx-error" role="alert"><UIcon name="i-lucide-circle-alert" class="size-[15px]" />{{ error }}</p>
      <span class="grow" />
      <button class="hx-btn lg hx-primary" type="submit" :disabled="!valid || busy">{{ busy ? t('Conferindo…') : t('Continuar') }}</button>
      <button type="button" class="hx-link center" @click="back">{{ t('Voltar para o login') }}</button>
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
.center {
  align-self: center;
}
</style>
