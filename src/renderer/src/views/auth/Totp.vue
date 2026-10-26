<script setup lang="ts">
import { computed, ref } from 'vue'
import { api, ApiError } from '../../api'
import { t } from '../../i18n'
import { S } from '../../store'
import { useCopy } from '../../copy'
import CodeInput from '../../components/CodeInput.vue'
import QrCode from '../../components/QrCode.vue'
import AuthShell from './AuthShell.vue'

const props = defineProps<{ otpauth: string; secret: string; mode: 'signup' | 'recover' }>()
const code = ref('')
const error = ref('')
const busy = ref(false)
const { copy } = useCopy()

const grouped = computed(() => props.secret.match(/.{1,4}/g)!.join(' '))
const user = computed(() => decodeURIComponent(props.otpauth.split('/totp/')[1].split('?')[0]).replace('Hideout:', ''))

async function verify(c: string): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await api('pending:totp', c)
    S.auth = { name: 'pin', mode: props.mode }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('Código incorreto.')
    code.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthShell
    :step="mode === 'signup' ? 2 : undefined"
    :title="t('Ative a verificação em duas etapas')"
    :lead="t('Abra o Google Authenticator, o Microsoft Authenticator ou o Authy no celular e escaneie o código. Ele será pedido quando você entrar num computador novo.')"
  >
    <div class="card">
      <QrCode :value="otpauth" :size="168" :label="t('QR Code para o app autenticador')" />
      <div class="side">
        <span>{{ t('Não consegue escanear? Digite esta chave no app:') }}</span>
        <span class="key mono">
          {{ grouped }}
          <button class="cpy" :aria-label="t('Copiar chave')" @click="copy(secret, { label: t('Chave'), secret: true })"><UIcon name="i-lucide-copy" class="size-[14px]" /></button>
        </span>
        <span class="muted">{{ t('Conta: Hideout ({user})', { user }) }}</span>
      </div>
    </div>
    <div class="hx-field">
      <span class="hx-label">{{ t('Digite o código de 6 dígitos que aparece no app') }}</span>
      <CodeInput v-model="code" :label="t('Código do autenticador')" autofocus @complete="verify" />
      <p v-if="error" class="hx-error" role="alert"><UIcon name="i-lucide-circle-alert" class="size-[15px]" />{{ error }}</p>
    </div>
    <span class="grow" />
    <button class="hx-btn lg hx-primary" :disabled="code.length !== 6 || busy" @click="verify(code)">{{ t('Confirmar e continuar') }}</button>
  </AuthShell>
</template>

<style scoped>
.card {
  display: flex;
  gap: 20px;
  align-items: center;
  background: var(--hx-surface);
  border-radius: 16px;
  padding: 18px;
  flex-wrap: wrap;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13.5px;
  line-height: 1.5;
  flex: 1 1 180px;
}
.key {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  background: var(--hx-bg);
  border: 1px solid var(--hx-line);
  border-radius: 8px;
  padding: 6px 8px 6px 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  word-break: break-all;
  user-select: text;
}
.cpy {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
}
.muted {
  color: var(--hx-muted);
}
.grow {
  flex-grow: 1;
}
</style>
