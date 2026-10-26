<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AppState, LoginStep } from '@shared/types'
import { api, ApiError } from '../../api'
import { S } from '../../store'
import CodeInput from '../../components/CodeInput.vue'
import AuthShell from './AuthShell.vue'

const props = defineProps<{ user?: string }>()
const user = ref(props.user ?? '')
const pw = ref('')
const totp = ref('')
const needTotp = ref(false)
const show = ref(false)
const busy = ref(false)
const error = ref(S.lockReason ?? '')

const users = computed(() => S.app?.users ?? [])
const folder = computed(() => S.app?.settings.vaultDir ?? '')
const lead = computed(() =>
  needTotp.value
    ? 'Primeira vez neste computador. Confirme com o código do app autenticador.'
    : 'Entre com seu usuário e a senha mestra.'
)

async function submit(): Promise<void> {
  if (busy.value || !user.value || !pw.value) return
  busy.value = true
  error.value = ''
  try {
    const r = await api<LoginStep>('login', user.value, pw.value, needTotp.value ? totp.value : undefined)
    if (r.needTotp) {
      needTotp.value = true
      return
    }
    S.lockReason = null
    S.auth = { name: 'pin', mode: 'login' }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Não foi possível entrar.'
    if ((e as ApiError).code === 'bad_totp') totp.value = ''
  } finally {
    busy.value = false
  }
}

async function pickDir(): Promise<void> {
  S.app = await api<AppState>('settings:pickDir')
}
</script>

<template>
  <AuthShell logo title="Entrar na sua conta" :lead="lead">
    <form class="form" @submit.prevent="submit">
      <div class="hx-field">
        <label class="hx-label" for="li-user">Usuário</label>
        <div class="hx-in lg">
          <input id="li-user" v-model="user" list="li-users" autocomplete="username" spellcheck="false" :autofocus="!user" />
          <datalist id="li-users"><option v-for="u in users" :key="u" :value="u" /></datalist>
        </div>
      </div>
      <div class="hx-field">
        <label class="hx-label" for="li-pw">Senha mestra</label>
        <div class="hx-in lg">
          <input id="li-pw" v-model="pw" :type="show ? 'text' : 'password'" autocomplete="current-password" :autofocus="!!user" />
          <button type="button" class="hx-ib" :aria-label="show ? 'Ocultar senha' : 'Mostrar senha'" @click="show = !show">
            <UIcon :name="show ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-[17px]" />
          </button>
        </div>
      </div>
      <template v-if="needTotp">
        <div class="note">
          <UIcon name="i-lucide-monitor-smartphone" class="size-[18px] shrink-0" />
          <span>O Hideout ainda não conhece este computador. Digite o código do autenticador.</span>
        </div>
        <div class="hx-field">
          <span class="hx-label">Código do autenticador</span>
          <CodeInput v-model="totp" label="Código do autenticador" autofocus @complete="submit" />
        </div>
        <button type="button" class="hx-link left" @click="S.auth = { name: 'recover', user }">Perdi o celular: usar código de recuperação</button>
      </template>
      <p v-if="error" class="hx-error" role="alert"><UIcon name="i-lucide-circle-alert" class="size-[15px]" />{{ error }}</p>
      <div v-if="!users.length" class="empty">
        <span>Nenhum cofre encontrado em <b>{{ folder }}</b>.</span>
        <button type="button" class="hx-link" @click="pickDir">Escolher outra pasta</button>
      </div>
      <span class="grow" />
      <button class="hx-btn lg hx-primary" type="submit" :disabled="busy || !user || !pw || (needTotp && totp.length !== 6)">
        {{ busy ? 'Abrindo…' : 'Entrar' }}
      </button>
      <div class="links">
        <button type="button" class="hx-link" @click="S.auth = { name: 'recover', user }">Esqueci a senha</button>
        <button type="button" class="hx-link muted" @click="S.auth = { name: 'signup' }">Criar outra conta</button>
      </div>
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
.note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: var(--hx-soft);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--hx-soft-ink);
}
.left {
  align-self: flex-start;
  padding-left: 0;
}
.empty {
  font-size: 13px;
  color: var(--hx-muted);
  line-height: 1.5;
  word-break: break-all;
}
.grow {
  flex-grow: 1;
}
.links {
  display: flex;
  justify-content: center;
  gap: 18px;
}
.muted {
  color: var(--hx-muted);
}
</style>
