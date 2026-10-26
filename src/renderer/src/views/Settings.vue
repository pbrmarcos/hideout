<script setup lang="ts">
import { computed, ref } from 'vue'
import { LANGS } from '@shared/i18n'
import { CUSTOM_IDS, THEMES, completeTheme, type CustomId } from '@shared/themes'
import type { AlertSettings, AppState, Lang, Settings, SignupStart, SoundId, UpdateState, VaultData } from '@shared/types'
import { api, ApiError } from '../api'
import { useCopy } from '../copy'
import { relDate } from '../format'
import { t } from '../i18n'
import { SOUND_IDS, SOUND_LABEL, playSound } from '../sounds'
import { S, installUpdate, logout, setLang, setTheme } from '../store'
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

const lockItems = computed(() => [1, 2, 5, 10, 15, 30, 60].map((m) => ({ label: m === 60 ? t('1 hora') : m === 1 ? t('1 minuto') : t('{n} minutos', { n: m }), value: m })))
const clipItems = computed(() => [10, 20, 30, 45, 60, 90].map((s) => ({ label: t('{n} segundos', { n: s }), value: s })))
const langItems = computed(() => [
  { label: t('Igual ao Windows'), value: 'auto' },
  ...LANGS.map((l) => ({ label: l.label, value: l.id }))
])
// --- alerts -------------------------------------------------------------------------
const soundItems = computed(() => SOUND_IDS.map((id) => ({ label: t(SOUND_LABEL[id]), value: id })))
const leadItems = computed(() =>
  [0, 5, 10, 15, 30, 60].map((m) => ({ label: m === 0 ? t('Na hora') : m === 60 ? t('1 hora antes') : t('{n} min antes', { n: m }), value: m }))
)
const al = computed(() => st.value.alerts)

function setAlerts(patch: Partial<AlertSettings>): void {
  void set({ alerts: { ...al.value, ...patch } })
}
function testSound(id: SoundId): void {
  if (id === 'windows') void api('sound:test', id).catch(fail)
  else playSound(id, al.value.volume)
}
let volTimer: ReturnType<typeof setTimeout> | null = null
function setVolume(v: number | undefined): void {
  if (v === undefined) return
  if (volTimer) clearTimeout(volTimer)
  volTimer = setTimeout(() => {
    setAlerts({ volume: v / 100 })
    playSound('pop', v / 100)
  }, 250)
}

// --- updates --------------------------------------------------------------------------
const updateText = computed(() => {
  const u = S.update
  const v = u.version ?? ''
  switch (u.status) {
    case 'dev': return t('Atualizações só funcionam no app instalado.')
    case 'checking': return t('Procurando…')
    case 'latest': return t('Você está na versão mais recente.')
    case 'downloading': return t('Baixando a versão {v}… {p}%', { v, p: u.percent })
    case 'ready': return t('A versão {v} está pronta para instalar.', { v })
    case 'manual': return t('A versão {v} está disponível para baixar.', { v })
    case 'error': return t('Não foi possível verificar agora.')
    default: return ''
  }
})
async function checkNow(): Promise<void> {
  try {
    S.update = await api<UpdateState>('update:check')
  } catch (e) {
    fail(e)
  }
}

const devices = computed(() => [...S.data!.devices].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)))

const customs = computed(() =>
  CUSTOM_IDS.map((id, i) => {
    const c = st.value.customThemes[id]
    return { id, n: i + 1, theme: c ? completeTheme(id, c) : null }
  })
)
function editCustom(id: CustomId): void {
  S.sheet = { kind: 'theme', id }
}

async function pickDir(): Promise<void> {
  S.app = await api<AppState>('settings:pickDir')
  info(t('Pasta alterada'), t('Saia e entre de novo para usar um cofre desta pasta.'))
}

async function backup(): Promise<void> {
  try {
    if (await api<boolean>('backup:export')) info(t('Backup salvo'), t('O arquivo continua criptografado com sua senha mestra.'))
  } catch (e) {
    fail(e)
  }
}

async function removeDevice(id: string): Promise<void> {
  try {
    S.data = await api<VaultData>('account:removeDevice', id)
    info(t('Computador removido'), t('Ele vai pedir usuário, senha e 2FA na próxima vez.'))
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
    err.value = e instanceof ApiError ? e.message : t('Não deu certo.')
  } finally {
    busy.value = false
  }
}

const changePassword = (): Promise<void> =>
  run(async () => {
    if (f.value.next !== f.value.next2) throw new ApiError(t('As senhas novas não conferem.'))
    await api('account:password', f.value.current, f.value.next)
    dialog.value = null
    info(t('Senha mestra alterada'), t('Use a nova senha nos outros computadores também.'))
  })

function onPin(p: string): void {
  if (!f.value.pinFirst) {
    f.value.pinFirst = p
    setTimeout(() => (f.value.pin = ''), 120)
    return
  }
  if (p !== f.value.pinFirst) {
    err.value = t('Os PINs não conferem. Comece de novo.')
    f.value.pin = ''
    f.value.pinFirst = ''
    return
  }
  void run(async () => {
    await api('account:pin', p)
    dialog.value = null
    info(t('PIN alterado'))
  })
}

const totpBegin = (): Promise<void> => run(async () => void (otp.value = await api<SignupStart>('account:totpBegin', f.value.current)))
const totpConfirm = (code: string): Promise<void> =>
  run(async () => {
    await api('account:totpConfirm', code)
    dialog.value = null
    info(t('2FA atualizado'), t('O código antigo do autenticador não funciona mais. Pode apagá-lo do celular.'))
  })
const recovery = (): Promise<void> => run(async () => void (newCode.value = await api<string>('account:recovery', f.value.current)))

const dialogTitle = computed(
  () => ({ password: t('Trocar senha mestra'), pin: t('Trocar PIN'), totp: t('Novo QR Code do 2FA'), recovery: t('Novo código de recuperação') })[dialog.value ?? 'password']
)
</script>

<template>
  <Sheet :title="t('Configurações')" back @close="S.sheet = null">
    <section>
      <h2>{{ t('Aparência') }}</h2>
      <div class="themes" role="radiogroup" :aria-label="t('Tema')">
        <button v-for="th in THEMES" :key="th.id" class="th" role="radio" :aria-checked="S.theme === th.id" :class="{ on: S.theme === th.id }" @click="setTheme(th.id)">
          <span class="chipc" :style="{ background: th.bg, boxShadow: `inset 0 0 0 1px ${th.line}` }"><i :style="{ background: th.primary }" /></span>
          {{ th.name }}
        </button>
      </div>
      <h3 class="sub">{{ t('Seus temas') }}</h3>
      <div class="customs">
        <div v-for="c in customs" :key="c.id" class="custom" :class="{ on: S.theme === c.id }">
          <button v-if="c.theme" class="pick" role="radio" :aria-checked="S.theme === c.id" @click="setTheme(c.id)">
            <span class="chipc" :style="{ background: c.theme.bg, boxShadow: `inset 0 0 0 1px ${c.theme.line}` }"><i :style="{ background: c.theme.primary }" /></span>
            <span class="cname">{{ c.theme.name }}</span>
          </button>
          <button v-else class="pick empty" @click="editCustom(c.id)">
            <span class="chipc dashed"><UIcon name="i-lucide-plus" class="size-4" /></span>
            <span class="cname">{{ t('Personalizado {n}', { n: c.n }) }}</span>
          </button>
          <UTooltip :text="c.theme ? t('Editar cores') : t('Criar tema')">
            <button class="hx-ib edit" :aria-label="c.theme ? t('Editar cores') : t('Criar tema')" @click="editCustom(c.id)"><UIcon name="i-lucide-pencil" class="size-4" /></button>
          </UTooltip>
        </div>
      </div>
      <p class="hx-hint pad">{{ t('Crie até 3 temas com as suas cores. Dá para pedir as cores a uma IA e colar a resposta.') }}</p>
      <div class="r"><span class="l">{{ t('Idioma') }}</span><USelect :model-value="st.lang ?? 'auto'" :items="langItems" class="w-44" @update:model-value="(v) => setLang(v === 'auto' ? null : (v as Lang))" /></div>
    </section>

    <section>
      <h2>{{ t('Segurança') }}</h2>
      <div class="r"><span class="l">{{ t('Trancar depois de ficar parado') }}</span><USelect :model-value="st.autoLockMinutes" :items="lockItems" class="w-36" @update:model-value="(v) => set({ autoLockMinutes: Number(v) })" /></div>
      <div class="r"><span class="l">{{ t('Trancar quando o Windows for bloqueado') }}</span><USwitch :model-value="st.lockOnWindowsLock" :aria-label="t('Trancar com o Windows')" @update:model-value="(v) => set({ lockOnWindowsLock: v })" /></div>
      <div class="r"><span class="l">{{ t('Apagar senha copiada depois de') }}</span><USelect :model-value="st.clipboardSeconds" :items="clipItems" class="w-36" @update:model-value="(v) => set({ clipboardSeconds: Number(v) })" /></div>
      <p class="hx-hint pad">{{ t('Senhas copiadas não entram no histórico da área de transferência do Windows (Win+V) nem na sincronização na nuvem.') }}</p>
      <button class="act" @click="S.sheet = { kind: 'leaks' }"><UIcon name="i-lucide-shield-alert" class="size-4" />{{ t('Verificar vazamentos') }}</button>
    </section>

    <section>
      <h2>{{ t('Alertas') }}</h2>
      <div class="subt">{{ t('Agenda') }}</div>
      <div class="r"><span class="l">{{ t('Notificar lembretes') }}</span><USwitch :model-value="al.agendaNotify" :aria-label="t('Notificar lembretes')" @update:model-value="(v) => setAlerts({ agendaNotify: v })" /></div>
      <template v-if="al.agendaNotify">
        <div class="r"><span class="l">{{ t('Avisar') }}</span><USelect :model-value="al.agendaLead" :items="leadItems" class="w-40" @update:model-value="(v) => setAlerts({ agendaLead: Number(v) })" /></div>
        <div class="r">
          <span class="l">{{ t('Som') }}</span>
          <USelect :model-value="al.agendaSound" :items="soundItems" class="w-40" @update:model-value="(v) => setAlerts({ agendaSound: v as SoundId })" />
          <button class="hx-ib" :aria-label="t('Testar som')" :disabled="al.agendaSound === 'none'" @click="testSound(al.agendaSound)"><UIcon name="i-lucide-play" class="size-4" /></button>
        </div>
      </template>
      <div class="subt">{{ t('TO DO') }}</div>
      <div class="r">
        <span class="l">{{ t('Resumo diário dos pendentes') }}<span class="s">{{ t('Uma notificação por dia, no horário escolhido') }}</span></span>
        <USwitch :model-value="!!al.todoDaily" :aria-label="t('Resumo diário dos pendentes')" @update:model-value="(v) => setAlerts({ todoDaily: v ? '09:00' : null })" />
      </div>
      <template v-if="al.todoDaily">
        <div class="r">
          <span class="l">{{ t('Horário') }}</span>
          <div class="hx-in w-40"><input type="time" :value="al.todoDaily" :aria-label="t('Horário do resumo')" @change="(e) => (e.target as HTMLInputElement).value && setAlerts({ todoDaily: (e.target as HTMLInputElement).value })" /></div>
        </div>
        <div class="r">
          <span class="l">{{ t('Som') }}</span>
          <USelect :model-value="al.todoSound" :items="soundItems" class="w-40" @update:model-value="(v) => setAlerts({ todoSound: v as SoundId })" />
          <button class="hx-ib" :aria-label="t('Testar som')" :disabled="al.todoSound === 'none'" @click="testSound(al.todoSound)"><UIcon name="i-lucide-play" class="size-4" /></button>
        </div>
      </template>
      <div class="subt">{{ t('Temporizador') }}</div>
      <div class="r">
        <span class="l">{{ t('Som ao terminar') }}</span>
        <USelect :model-value="al.timerSound" :items="soundItems" class="w-40" @update:model-value="(v) => setAlerts({ timerSound: v as SoundId })" />
        <button class="hx-ib" :aria-label="t('Testar som')" :disabled="al.timerSound === 'none'" @click="testSound(al.timerSound)"><UIcon name="i-lucide-play" class="size-4" /></button>
      </div>
      <div class="r">
        <span class="l">{{ t('Volume dos sons') }}</span>
        <UIcon name="i-lucide-volume-2" class="size-4 shrink-0 text-(--hx-muted)" />
        <USlider :default-value="Math.round(al.volume * 100)" :min="0" :max="100" :step="5" class="w-36" :aria-label="t('Volume dos sons')" @update:model-value="(v) => setVolume(v as number)" />
      </div>
      <p class="hx-hint pad">{{ t('O temporizador fica no ícone de relógio, no topo da janela.') }}</p>
    </section>

    <section>
      <h2>{{ t('Janela') }}</h2>
      <div class="r"><span class="l">{{ t('Abrir junto com o Windows (fica na bandeja)') }}</span><USwitch :model-value="st.startWithWindows" :aria-label="t('Iniciar com o Windows')" @update:model-value="(v) => set({ startWithWindows: v })" /></div>
      <div class="r"><span class="l">{{ t('Mostrar e esconder de qualquer lugar') }}</span><UKbd value="Ctrl" /><UKbd value="Alt" /><UKbd value="V" /></div>
      <p class="hx-hint pad">{{ t('Os botões no topo encaixam a janela na esquerda ou na direita, com 30% da largura e altura total. Arrastar a barra solta a janela.') }}</p>
    </section>

    <section>
      <h2>{{ t('Recursos') }}</h2>
      <div class="feat">
        <div class="fh">
          <UIcon name="i-lucide-keyboard" class="size-[18px] ic" />{{ t('Digitar login automático') }}<span class="grow" />
          <USwitch :model-value="st.autoType" :aria-label="t('Ativar digitação automática')" @update:model-value="(v) => set({ autoType: v })" />
        </div>
        <p>{{ t('Clique no campo de usuário (ou de senha) de qualquer site ou programa e aperte Ctrl+Alt+A. O Hideout acha o acesso pelo nome da janela, confere em que campo o cursor está e digita só o que cabe ali. Em logins de duas etapas, como o do Google, ele espera a página da senha. Se houver mais de um acesso, ele pergunta qual.') }}</p>
      </div>
      <div class="feat">
        <div class="fh"><UIcon name="i-lucide-paperclip" class="size-[18px] ic" />{{ t('Anexos criptografados') }}</div>
        <p>{{ t('Arraste PDFs, fotos de documentos ou certificados para dentro de um acesso ou nota. Eles ficam trancados junto com o cofre, até 10 MB cada.') }}</p>
      </div>
      <div class="feat">
        <div class="fh"><UIcon name="i-lucide-layout-grid" class="size-[18px] ic" />{{ t('Modelos prontos') }}</div>
        <p>{{ t('Em "Novo", escolha o tipo: acesso, cartão, Wi-Fi, documento, conta bancária ou servidor. Cada um vem com os campos certos, e o Wi-Fi gera um QR Code para o celular conectar.') }}</p>
      </div>
    </section>

    <section>
      <h2>{{ t('Conta: {user}', { user: S.user ?? '' }) }}</h2>
      <div class="r"><span class="l">{{ t('Senha mestra') }}</span><button class="hx-btn hx-soft sm" @click="openDialog('password')">{{ t('Trocar') }}</button></div>
      <div class="r"><span class="l">{{ t('PIN do dia a dia') }}<span class="s">{{ t('6 dígitos, 5 tentativas') }}</span></span><button class="hx-btn hx-soft sm" @click="openDialog('pin')">{{ t('Trocar') }}</button></div>
      <div class="r"><span class="l">{{ t('Verificação em duas etapas') }}</span><span class="ok">{{ t('Ativa') }}</span><button class="hx-btn hx-soft sm" @click="openDialog('totp')">{{ t('Novo QR Code') }}</button></div>
      <div class="r"><span class="l">{{ t('Código de recuperação') }}</span><button class="hx-btn hx-soft sm" @click="openDialog('recovery')">{{ t('Gerar novo') }}</button></div>
      <div class="subt">{{ t('Computadores conhecidos') }}</div>
      <div v-for="d in devices" :key="d.id" class="r dev">
        <UIcon name="i-lucide-monitor" class="size-4 shrink-0" />
        <span class="l">{{ d.name }}<span class="s">{{ d.id === S.deviceId ? t('Este computador') : t('Visto: {when}', { when: relDate(d.lastSeen) }) }}</span></span>
        <button v-if="d.id !== S.deviceId" class="hx-btn hx-danger sm" @click="removeDevice(d.id)">{{ t('Remover') }}</button>
      </div>
      <button class="hx-btn hx-danger out" @click="logout"><UIcon name="i-lucide-log-out" class="size-4" />{{ t('Sair da conta neste computador') }}</button>
    </section>

    <section>
      <h2>{{ t('Dados') }}</h2>
      <div class="r top"><span class="l">{{ t('Pasta dos cofres') }}<span class="s path">{{ st.vaultDir }}</span></span><button class="hx-btn hx-soft sm" @click="pickDir">{{ t('Alterar') }}</button></div>
      <div class="acts">
        <button class="act" @click="backup"><UIcon name="i-lucide-download" class="size-4" />{{ t('Exportar backup criptografado') }}</button>
        <button class="act" @click="S.sheet = { kind: 'trash' }"><UIcon name="i-lucide-trash-2" class="size-4" />{{ t('Lixeira (30 dias)') }}</button>
      </div>
      <div class="r">
        <span class="l">{{ t('Procurar atualizações') }}<span class="s">{{ t('Ao abrir e uma vez por dia. Só consulta a lista de versões no GitHub.') }}</span></span>
        <USwitch :model-value="st.checkUpdates" :aria-label="t('Procurar atualizações')" @update:model-value="(v) => set({ checkUpdates: v })" />
      </div>
      <div class="r">
        <span class="l">{{ t('Hideout {version}', { version: S.app?.version ?? '' }) }}<span v-if="updateText" class="s">{{ updateText }}</span></span>
        <button v-if="S.update.status === 'ready'" class="hx-btn hx-primary sm" @click="installUpdate">{{ t('Reiniciar e atualizar') }}</button>
        <button v-else-if="S.update.status === 'manual'" class="hx-btn hx-soft sm" @click="api('update:page')">{{ t('Baixar') }}</button>
        <button v-else class="hx-btn hx-soft sm" :disabled="['dev', 'checking', 'downloading'].includes(S.update.status)" @click="checkNow">{{ t('Procurar agora') }}</button>
      </div>
      <p class="hx-hint pad">{{ t('Código aberto, licença MIT.') }}</p>
    </section>

  <UModal :open="!!dialog" :title="dialogTitle" :close="{ 'aria-label': t('Fechar') }" @update:open="(o) => !o && (dialog = null)">
    <template #body>
      <form v-if="dialog === 'password'" class="dlg" @submit.prevent="changePassword">
        <div class="hx-field"><label class="hx-label" for="d-cur">{{ t('Senha atual') }}</label><div class="hx-in"><input id="d-cur" v-model="f.current" type="password" autofocus /></div></div>
        <div class="hx-field"><label class="hx-label" for="d-new">{{ t('Nova senha') }}</label><div class="hx-in"><input id="d-new" v-model="f.next" type="password" /></div><StrengthMeter :value="f.next" /></div>
        <div class="hx-field"><label class="hx-label" for="d-new2">{{ t('Repita a nova senha') }}</label><div class="hx-in"><input id="d-new2" v-model="f.next2" type="password" /></div></div>
        <p v-if="err" class="hx-error" role="alert">{{ err }}</p>
        <button class="hx-btn hx-primary" :disabled="busy || f.next.length < 12 || !f.current">{{ t('Trocar senha') }}</button>
      </form>

      <div v-else-if="dialog === 'pin'" class="dlg center">
        <span class="hx-label">{{ f.pinFirst ? t('Repita o novo PIN') : t('Digite o novo PIN de 6 dígitos') }}</span>
        <PinPad v-model="f.pin" :disabled="busy" @complete="onPin" />
        <p v-if="err" class="hx-error" role="alert">{{ err }}</p>
      </div>

      <div v-else-if="dialog === 'totp'" class="dlg">
        <form v-if="!otp" class="dlg" @submit.prevent="totpBegin">
          <p class="hx-hint">{{ t('Use isto se trocou de celular. Confirme com a senha mestra.') }}</p>
          <div class="hx-field"><label class="hx-label" for="d-tp">{{ t('Senha mestra') }}</label><div class="hx-in"><input id="d-tp" v-model="f.current" type="password" autofocus /></div></div>
          <p v-if="err" class="hx-error" role="alert">{{ err }}</p>
          <button class="hx-btn hx-primary" :disabled="busy || !f.current">{{ t('Continuar') }}</button>
        </form>
        <template v-else>
          <div class="qr"><QrCode :value="otp.otpauth" :size="160" :label="t('Novo QR Code do autenticador')" /></div>
          <span class="hx-label">{{ t('Código que aparece no app') }}</span>
          <CodeInput v-model="f.code" :label="t('Código do autenticador')" autofocus @complete="totpConfirm" />
          <p v-if="err" class="hx-error" role="alert">{{ err }}</p>
        </template>
      </div>

      <div v-else-if="dialog === 'recovery'" class="dlg">
        <form v-if="!newCode" class="dlg" @submit.prevent="recovery">
          <p class="hx-hint">{{ t('O código antigo deixa de funcionar. Confirme com a senha mestra.') }}</p>
          <div class="hx-field"><label class="hx-label" for="d-rc">{{ t('Senha mestra') }}</label><div class="hx-in"><input id="d-rc" v-model="f.current" type="password" autofocus /></div></div>
          <p v-if="err" class="hx-error" role="alert">{{ err }}</p>
          <button class="hx-btn hx-primary" :disabled="busy || !f.current">{{ t('Gerar código') }}</button>
        </form>
        <template v-else>
          <div class="code mono">{{ newCode }}</div>
          <p class="hx-hint">{{ t('Anote num lugar seguro, fora deste computador. Ele não será mostrado de novo.') }}</p>
          <div class="row">
            <button class="hx-btn hx-soft" @click="copy(newCode, { label: t('Código'), secret: true })"><UIcon name="i-lucide-copy" class="size-4" />{{ t('Copiar') }}</button>
            <button class="hx-btn hx-primary" @click="dialog = null">{{ t('Guardei') }}</button>
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
h3.sub {
  margin: 12px 0 6px;
  font-size: 12.5px;
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
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chipc i {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 50%;
}
.chipc.dashed {
  border: 1.5px dashed var(--hx-muted);
  color: var(--hx-muted);
}
.customs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}
.custom {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: var(--hx-bg);
  padding: 6px 6px 6px 8px;
}
.custom.on {
  border-color: var(--hx-primary);
  background: var(--hx-soft);
}
.pick {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--hx-ink);
  cursor: pointer;
  text-align: left;
}
.pick.empty {
  color: var(--hx-muted);
}
.cname {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.edit {
  width: 30px;
  height: 30px;
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
.subt {
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
