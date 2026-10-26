<script setup lang="ts">
import { ref } from 'vue'
import type { UnlockInfo } from '@shared/types'
import { api, ApiError } from '../../api'
import { t } from '../../i18n'
import { S, enterVault } from '../../store'
import PinPad from '../../components/PinPad.vue'
import AuthShell from './AuthShell.vue'

const props = defineProps<{ mode: 'signup' | 'login' | 'recover' }>()
const first = ref('')
const pin = ref('')
const confirming = ref(false)
const error = ref('')
const shake = ref(false)
const busy = ref(false)

async function onComplete(value: string): Promise<void> {
  if (!confirming.value) {
    first.value = value
    confirming.value = true
    setTimeout(() => (pin.value = ''), 120)
    return
  }
  if (value !== first.value) {
    error.value = t('Os PINs não conferem. Crie de novo.')
    shake.value = true
    setTimeout(() => {
      shake.value = false
      pin.value = ''
      first.value = ''
      confirming.value = false
    }, 400)
    return
  }
  busy.value = true
  try {
    const r = await api<{ recoveryCode: string | null; info: UnlockInfo }>('pending:finish', value)
    if (r.recoveryCode) S.auth = { name: 'recovery-code', code: r.recoveryCode, info: r.info }
    else await enterVault(r.info)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('Não foi possível salvar o PIN.')
    pin.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthShell
    :step="props.mode === 'signup' ? 3 : undefined"
    :title="t('Crie um PIN para o dia a dia')"
    :lead="t('Com o PIN você abre o Hideout rapidinho neste computador. A senha mestra só volta a ser pedida se você sair da conta ou errar o PIN 5 vezes.')"
  >
    <div class="center">
      <span class="ask">{{ busy ? t('Protegendo o PIN…') : confirming ? t('Repita o PIN de 6 dígitos') : t('Escolha um PIN de 6 dígitos') }}</span>
      <PinPad v-model="pin" :disabled="busy" :error="shake" @complete="onComplete" />
      <p v-if="error" class="hx-error" role="alert">{{ error }}</p>
      <span class="hx-hint">{{ t('Também dá para digitar pelo teclado.') }}</span>
    </div>
  </AuthShell>
</template>

<style scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding-top: 6px;
}
.ask {
  font-size: 14px;
  font-weight: 600;
}
</style>
