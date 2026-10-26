<script setup lang="ts">
import { S } from '../../store'
import Lock from './Lock.vue'
import Login from './Login.vue'
import PinCreate from './PinCreate.vue'
import Recover from './Recover.vue'
import RecoveryCode from './RecoveryCode.vue'
import Signup from './Signup.vue'
import Totp from './Totp.vue'
</script>

<template>
  <Lock v-if="S.auth.name === 'lock'" :key="S.auth.user" :user="S.auth.user" />
  <Login v-else-if="S.auth.name === 'login'" :key="'login' + (S.auth.user ?? '')" :user="S.auth.user" />
  <Signup v-else-if="S.auth.name === 'signup'" />
  <Totp v-else-if="S.auth.name === 'totp'" :otpauth="S.auth.otpauth" :secret="S.auth.secret" :mode="S.auth.mode" />
  <PinCreate v-else-if="S.auth.name === 'pin'" :mode="S.auth.mode" />
  <RecoveryCode v-else-if="S.auth.name === 'recovery-code'" :code="S.auth.code" :info="S.auth.info" />
  <Recover v-else-if="S.auth.name === 'recover'" step="code" :user="S.auth.user" />
  <Recover v-else-if="S.auth.name === 'recover-password'" step="password" />
</template>
