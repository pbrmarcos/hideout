<script setup lang="ts">
import { computed, ref } from 'vue'
import { THEMES } from '@shared/themes'
import type { AppState, Settings, SignupStart, VaultData } from '@shared/types'
import { api, ApiError } from '../api'
import { useCopy } from '../copy'
import { relDate } from '../format'
import { S, logout, setTheme } from '../store'
import CodeInput from '../components/CodeInput.vue'
import PinPad from '../components/PinPad.vue'
import QrCode from '../components/QrCode.vue'
import Sheet from '../components/Sheet.vue'
import StrengthMeter from '../components/StrengthMeter.vue'

const { copy, fail, info } = useCopy()
const st = computed(() => S.app!.settings)

async function set(patch: Partial<Settings>): Promise<void> {
  try {
    S.app = await api<AppState>('settings:set', patch)
  } catch (e) {
    fail(e)
  }
}

const lockItems = [1, 2, 5, 10, 15, 30, 60].map((m) => ({ label: m === 60 ? '1 hora' : `${m} minuto${m > 1 ? 's' : ''}`, value: m }))
const clipItems = [10, 20, 30, 45, 60, 90].map((s) => ({ label: `${s} segundos`, value: s }))
const devices = computed(() => [...S.data!.devices].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)))

async function pickDir(): Promise<void> {
  S.app = await api<AppState>('settings:pickDir')
  info('Pasta alterada', 'Saia e entre de novo para usar um cofre desta pasta.')
}

async function backup(): Promise<void> {
  try {
    if (await api<boolean>('backup:export')) info('Backup salvo', 'O arquivo continua criptografado com sua senha mestra.')
  } catch (e) {
    fail(e)
  }
}

async function removeDevice(id: string): Promise<void> {
  try {
    S.data = await api<VaultData>('account:removeDevice', id)
    info('Computador removido', 'Ele vai pedir usuário, senha e 2FA na próxima vez.')
  } catch (e) {
    fail(e)
  }
}

// --- account dialogs -------------------------------------------------------------

type Dialog = null | 'password' | 'pin' | 'totp' | 'recovery'
const dialog = ref<Dialog>(null)
const f = ref({ current: '', next: '', next2: '', pin: '', pinFirst: '', code: '' })
const otp = ref<SignupStart | null>(null)
const newCode = ref('')
const err = ref('')
const busy = ref(false)

function openDialog(d: Dialog): void {
  f.value = { current: '', next: '', next2: '', pin: '', pinFirst: '', code: '' }
  otp.value = null
  newCode.value = ''
  err.value = ''
  dialog.value = d
}

async function run(fn: () => Promise<void>): Promise<void> {
  busy.value = true
  err.value = ''
  try {
    await fn()
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : 'Não deu certo.'
  } finally {
    busy.value = false
  }
}

const changePassword = (): Promise<void> =>
  run(async () => {
    if (f.value.next !== f.value.next2) throw new ApiError('As senhas novas não conferem.')
    await api('account:password', f.value.current, f.value.next)
    dialog.value = null
    info('Senha mestra alterada', 'Use a nova senha nos outros computadores também.')
  })

function onPin(p: string): void {
  if (!f.value.pinFirst) {
    f.value.pinFirst = p
    setTimeout(() => (f.value.pin = ''), 120)
    return
  }
  if (p !== f.value.pinFirst) {
    err.value = 'Os PINs não conferem. Comece de novo.'
    f.value.pin = ''
    f.value.pinFirst = ''
    return
  }
  void run(async () => {
    await api('account:pin', p)
    dialog.value = null
    info('PIN alterado')
  })
}

const totpBegin = (): Promise<void> => run(async () => void (otp.value = await api<SignupStart>('account:totpBegin', f.value.current)))
const totpConfirm = (code: string): Promise<void> =>
  run(async () => {
    await api('account:totpConfirm', code)
    dialog.value = null
    info('2FA atualizado', 'O código antigo do autenticador não funciona mais. Pode apagá-lo do celular.')
  })
const recovery = (): Promise<void> => run(async () => void (newCode.value = await api<string>('account:recovery', f.value.current)))

const dialogTitle = computed(
  () => ({ password: 'Trocar senha mestra', pin: 'Trocar PIN', totp: 'Novo QR Code do 2FA', recovery: 'Novo código de recuperação' })[dialog.value ?? 'password']
)
</script>

<template>
  <Sheet title="Configurações" back @close="S.sheet = null">
    <section>
      <h2>Aparência</h2>
      <div class="themes" role="radiogroup" aria-label="Tema">
        <button v-for="t in THEMES" :key="t.id" class="th" role="radio" :aria-checked="S.theme === t.id" :class="{ on: S.theme === t.id }" @click="setTheme(t.id)">
          <span class="chipc" :style="{ background: t.bg, boxShadow: `inset 0 0 0 1px ${t.line}` }"><i :style="{ background: t.primary }" /></span>
          {{ t.name }}
        </button>
      </div>
    </section>

    <section>
      <h2>Segurança</h2>
      <div class="r"><span class="l">Trancar depois de ficar parado</span><USelect :model-value="st.autoLockMinutes" :items="lockItems" class="w-36" @update:model-value="(v) => set({ autoLockMinutes: Number(v) })" /></div>
      <div class="r"><span class="l">Trancar quando o Windows for bloqueado</span><USwitch :model-value="st.lockOnWindowsLock" aria-label="Trancar com o Windows" @update:model-value="(v) => set({ lockOnWindowsLock: v })" /></div>
      <div class="r"><span class="l">Apagar senha copiada depois de</span><USelect :model-value="st.clipboardSeconds" :items="clipItems" class="w-36" @update:model-value="(v) => set({ clipboardSeconds: Number(v) })" /></div>
      <p class="hx-hint pad">Senhas copiadas não entram no histórico da área de transferência do Windows (Win+V) nem na sincronização na nuvem.</p>
    </section>

    <section>
      <h2>Janela</h2>
      <div class="r"><span class="l">Abrir junto com o Windows (fica na bandeja)</span><USwitch :model-value="st.startWithWindows" aria-label="Iniciar com o Windows" @update:model-value="(v) => set({ startWithWindows: v })" /></div>
      <div class="r"><span class="l">Mostrar e esconder de qualquer lugar</span><UKbd value="Ctrl" /><UKbd value="Alt" /><UKbd value="V" /></div>
      <p class="hx-hint pad">Os botões no topo encaixam a janela na esquerda ou na direita, com 30% da largura e altura total. Arrastar a barra solta a janela.</p>
    </section>

    <section>
      <h2>Recursos</h2>
      <div class="feat">
        <div class="fh">
          <UIcon name="i-lucide-keyboard" class="size-[18px] ic" />Digitar login automático<span class="grow" />
          <USwitch :model-value="st.autoType" aria-label="Ativar digitação automática" @update:model-value="(v) => set({ autoType: v })" />
        </div>
        <p>Clique no campo de usuário de qualquer site ou programa e aperte <UKbd value="Ctrl" /> <UKbd value="Alt" /> <UKbd value="A" />. O Hideout acha o acesso pelo nome da janela e digita usuário, Tab, senha e Enter. Se houver mais de um, ele pergunta qual.</p>
      </div>
      <div class="feat">
        <div class="fh"><UIcon name="i-lucide-paperclip" class="size-[18px] ic" />Anexos criptografados</div>
        <p>Arraste PDFs, fotos de documentos ou certificados para dentro de um acesso ou nota. Eles ficam trancados junto com o cofre, até 10 MB cada.</p>
      </div>
      <div class="feat">
        <div class="fh"><UIcon name="i-lucide-layout-grid" class="size-[18px] ic" />Modelos prontos</div>
        <p>Em "Novo", escolha o tipo: acesso, cartão, Wi-Fi, documento, conta bancária ou servidor. Cada um vem com os campos certos, e o Wi-Fi gera um QR Code para o celular conectar.</p>
      </div>
    </section>

    <section>
      <h2>Conta: {{ S.user }}</h2>
      <div class="r"><span class="l">Senha mestra</span><button class="hx-btn hx-soft sm" @click="openDialog('password')">Trocar</button></div>
      <div class="r"><span class="l">PIN do dia a dia<span class="s">6 dígitos, 5 tentativas</span></span><button class="hx-btn hx-soft sm" @click="openDialog('pin')">Trocar</button></div>
      <div class="r"><span class="l">Verificação em duas etapas</span><span class="ok">Ativa</span><button class="hx-btn hx-soft sm" @click="openDialog('totp')">Novo QR Code</button></div>
      <div class="r"><span class="l">Código de recuperação</span><button class="hx-btn hx-soft sm" @click="openDialog('recovery')">Gerar novo</button></div>
      <div class="sub">Computadores conhecidos</div>
      <div v-for="d in devices" :key="d.id" class="r dev">
        <UIcon name="i-lucide-monitor" class="size-4 shrink-0" />
        <span class="l">{{ d.name }}<span class="s">{{ d.id === S.deviceId ? 'Este computador' : `Visto: ${relDate(d.lastSeen)}` }}</span></span>
        <button v-if="d.id !== S.deviceId" class="hx-btn hx-danger sm" @click="removeDevice(d.id)">Remover</button>
      </div>
      <button class="hx-btn hx-danger out" @click="logout"><UIcon name="i-lucide-log-out" class="size-4" />Sair da conta neste computador</button>
    </section>

    <section>
      <h2>Dados</h2>
      <div class="r top"><span class="l">Pasta dos cofres<span class="s path">{{ st.vaultDir }}</span></span><button class="hx-btn hx-soft sm" @click="pickDir">Alterar</button></div>
      <div class="acts">
        <button class="act" @click="backup"><UIcon name="i-lucide-download" class="size-4" />Exportar backup criptografado</button>
        <button class="act" @click="S.sheet = { kind: 'trash' }"><UIcon name="i-lucide-trash-2" class="size-4" />Lixeira (30 dias)</button>
      </div>
      <p class="hx-hint pad">Hideout {{ S.app?.version }}. Código aberto, licença MIT.</p>
    </section>

  <UModal :open="!!dialog" :title="dialogTitle" :close="{ 'aria-label': 'Fechar' }" @update:open="(o) => !o && (dialog = null)">
    <template #body>
      <form v-if="dialog === 'password'" class="dlg" @submit.prevent="changePassword">
        <div class="hx-field"><label class="hx-label" for="d-cur">Senha atual</label><div class="hx-in"><input id="d-cur" v-model="f.current" type="password" autofocus /></div></div>
        <div class="hx-field"><label class="hx-label" for="d-new">Nova senha</label><div class="hx-in"><input id="d-new" v-model="f.next" type="password" /></div><StrengthMeter :value="f.next" /></div>
        <div class="hx-field"><label class="hx-label" for="d-new2">Repita a nova senha</label><div class="hx-in"><input id="d-new2" v-model="f.next2" type="password" /></div></div>
        <p v-if="err" class="hx-error" role="alert">{{ err }}</p>
        <button class="hx-btn hx-primary" :disabled="busy || f.next.length < 12 || !f.current">Trocar senha</button>
      </form>

      <div v-else-if="dialog === 'pin'" class="dlg center">
        <span class="hx-label">{{ f.pinFirst ? 'Repita o novo PIN' : 'Digite o novo PIN de 6 dígitos' }}</span>
        <PinPad v-model="f.pin" :disabled="busy" @complete="onPin" />
        <p v-if="err" class="hx-error" role="alert">{{ err }}</p>
      </div>

      <div v-else-if="dialog === 'totp'" class="dlg">
        <form v-if="!otp" class="dlg" @submit.prevent="totpBegin">
          <p class="hx-hint">Use isto se trocou de celular. Confirme com a senha mestra.</p>
          <div class="hx-field"><label class="hx-label" for="d-tp">Senha mestra</label><div class="hx-in"><input id="d-tp" v-model="f.current" type="password" autofocus /></div></div>
          <p v-if="err" class="hx-error" role="alert">{{ err }}</p>
          <button class="hx-btn hx-primary" :disabled="busy || !f.current">Continuar</button>
        </form>
        <template v-else>
          <div class="qr"><QrCode :value="otp.otpauth" :size="160" label="Novo QR Code do autenticador" /></div>
          <span class="hx-label">Código que aparece no app</span>
          <CodeInput v-model="f.code" label="Código do autenticador" autofocus @complete="totpConfirm" />
          <p v-if="err" class="hx-error" role="alert">{{ err }}</p>
        </template>
      </div>

      <div v-else-if="dialog === 'recovery'" class="dlg">
        <form v-if="!newCode" class="dlg" @submit.prevent="recovery">
          <p class="hx-hint">O código antigo deixa de funcionar. Confirme com a senha mestra.</p>
          <div class="hx-field"><label class="hx-label" for="d-rc">Senha mestra</label><div class="hx-in"><input id="d-rc" v-model="f.current" type="password" autofocus /></div></div>
          <p v-if="err" class="hx-error" role="alert">{{ err }}</p>
          <button class="hx-btn hx-primary" :disabled="busy || !f.current">Gerar código</button>
        </form>
        <template v-else>
          <div class="code mono">{{ newCode }}</div>
          <p class="hx-hint">Anote num lugar seguro, fora deste computador. Ele não será mostrado de novo.</p>
          <div class="row">
            <button class="hx-btn hx-soft" @click="copy(newCode, { label: 'Código', secret: true })"><UIcon name="i-lucide-copy" class="size-4" />Copiar</button>
            <button class="hx-btn hx-primary" @click="dialog = null">Guardei</button>
          </div>
        </template>
      </div>
    </template>
  </UModal>
  </Sheet>
</template>

<style scoped>
section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--hx-line);
}
section:last-child {
  border-bottom: 0;
}
h2 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--hx-muted);
}
.themes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: 8px;
}
.th {
  border-radius: 12px;
  padding: 10px 4px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  border: 2px solid transparent;
  background: var(--hx-bg);
  color: var(--hx-ink);
}
.th.on {
  border-color: var(--hx-primary);
  background: var(--hx-soft);
}
.chipc {
  width: 34px;
  height: 34px;
  border-radius: 17px;
  position: relative;
  overflow: hidden;
}
.chipc i {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 50%;
}
.r {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  font-size: 14px;
}
.r.top {
  align-items: flex-start;
  padding-top: 6px;
}
.l {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.s {
  font-size: 12.5px;
  color: var(--hx-muted);
}
.path {
  word-break: break-all;
}
.sm {
  height: 32px;
  font-size: 13px;
  padding: 0 12px;
}
.ok {
  font-size: 12px;
  font-weight: 700;
  color: var(--hx-soft-ink);
  background: var(--hx-soft);
  border-radius: 6px;
  padding: 3px 8px;
}
.pad {
  margin: 4px 0 6px;
}
.sub {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--hx-muted);
  margin-top: 8px;
}
.dev {
  min-height: 40px;
}
.out {
  align-self: flex-start;
  margin-top: 6px;
  padding-left: 8px;
}
.feat {
  border-radius: 12px;
  background: var(--hx-bg);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}
.fh {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
}
.ic {
  color: var(--hx-primary);
}
.grow {
  flex-grow: 1;
}
.feat p {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--hx-muted);
}
.acts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}
.act {
  height: 40px;
  border-radius: 10px;
  font: inherit;
  font-weight: 600;
  font-size: 13.5px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 0;
  cursor: pointer;
  background: var(--hx-bg);
  color: var(--hx-ink);
  text-align: left;
}
.act:hover {
  background: var(--hx-line);
}
.dlg {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.center {
  align-items: center;
}
.qr {
  display: flex;
  justify-content: center;
}
.code {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-align: center;
  background: var(--hx-bg);
  border-radius: 10px;
  padding: 14px;
  user-select: text;
}
.row {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
