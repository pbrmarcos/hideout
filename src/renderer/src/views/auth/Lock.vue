<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AppState, UnlockInfo } from '@shared/types'
import { api, ApiError } from '../../api'
import { t } from '../../i18n'
import { S, enterVault, setTheme } from '../../store'
import Logo from '../../components/Logo.vue'
import PinPad from '../../components/PinPad.vue'

const props = defineProps<{ user: string }>()
const pin = ref('')
const error = ref('')
const shake = ref(false)
const busy = ref(false)

const reasons = computed<Record<string, string>>(() => ({
  idle: t('Trancado por inatividade.'),
  windows: t('Trancado junto com o Windows.'),
  manual: ''
}))
const subtitle = computed(() => (S.lockReason && reasons.value[S.lockReason]) || t('Digite seu PIN para abrir.'))

const otherUsers = computed(() => {
  const all = new Set([...(S.app?.sessions ?? []), ...(S.app?.users ?? [])])
  all.delete(props.user)
  return [...all]
})
const menu = computed(() => [
  otherUsers.value.map((u) => ({ label: u, icon: 'i-lucide-user', onSelect: () => switchTo(u) })),
  [{ label: t('Criar outra conta'), icon: 'i-lucide-user-plus', onSelect: () => (S.auth = { name: 'signup' }) }]
])

function switchTo(u: string): void {
  setTheme(S.app?.settings.themes[u], false)
  S.auth = S.app?.sessions.includes(u) ? { name: 'lock', user: u } : { name: 'login', user: u }
  pin.value = ''
  error.value = ''
}

async function unlock(value: string): Promise<void> {
  busy.value = true
  error.value = ''
  try {
    await enterVault(await api<UnlockInfo>('unlock:pin', props.user, value))
  } catch (e) {
    const err = e as ApiError
    if (['pin_locked', 'no_session', 'revoked'].includes(err.code ?? '')) {
      S.app = await api<AppState>('app:state')
      S.auth = { name: 'login', user: props.user }
      S.lockReason = err.message
      return
    }
    error.value = err.message
    shake.value = true
    setTimeout(() => {
      shake.value = false
      pin.value = ''
    }, 400)
  } finally {
    busy.value = false
  }
}

async function signOut(): Promise<void> {
  S.app = await api<AppState>('vault:logout', props.user)
  S.auth = { name: 'login', user: props.user }
}
</script>

<template>
  <div class="lock">
    <div class="center">
      <Logo :size="56" />
      <UDropdownMenu :items="menu" :content="{ align: 'center' }">
        <button class="user" :aria-label="t('Trocar de usuário')">
          <span class="a">{{ user[0]?.toUpperCase() }}</span>{{ user }}
          <UIcon name="i-lucide-chevron-down" class="size-[14px] opacity-70" />
        </button>
      </UDropdownMenu>
      <div class="titles">
        <h1>{{ busy ? t('Abrindo seu cofre…') : t('Bem-vindo de volta') }}</h1>
        <p>{{ subtitle }}</p>
      </div>
      <PinPad v-model="pin" :disabled="busy" :error="shake" @complete="unlock" />
      <p v-if="error" class="hx-error" role="alert">{{ error }}</p>
    </div>
    <div class="links">
      <button class="hx-link" @click="S.auth = { name: 'login', user }">{{ t('Entrar com a senha') }}</button>
      <button class="hx-link muted" @click="signOut">{{ t('Sair da conta') }}</button>
    </div>
  </div>
</template>

<style scoped>
.lock {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.center {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 16px 24px;
  text-align: center;
}
.user {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  border-radius: 20px;
  padding: 0 14px 0 5px;
  background: var(--hx-surface);
  border: 0;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--hx-ink);
  cursor: pointer;
  box-shadow: 0 0 0 1px var(--hx-line);
}
.user .a {
  width: 30px;
  height: 30px;
  border-radius: 15px;
  background: var(--hx-soft);
  color: var(--hx-soft-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.titles h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}
.titles p {
  margin: 6px 0 0;
  font-size: 14.5px;
  color: var(--hx-muted);
}
.links {
  display: flex;
  justify-content: center;
  gap: 18px;
  padding: 0 24px 22px;
}
.muted {
  color: var(--hx-muted);
}
</style>
