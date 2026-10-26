<script setup lang="ts">
import { onMounted, watchEffect } from 'vue'
import { S, boot } from './store'
import { lang, uiLocale } from './i18n'
import { localeOf } from '@shared/i18n'
import TitleBar from './components/TitleBar.vue'
import AuthFlow from './views/auth/AuthFlow.vue'
import MainShell from './views/MainShell.vue'

onMounted(boot)
watchEffect(() => (document.documentElement.lang = localeOf(lang.value)))
</script>

<template>
  <UApp :locale="uiLocale" :toaster="{ position: 'bottom-center', duration: 2500, max: 2 }" :tooltip="{ delayDuration: 400 }">
    <div class="frame">
      <TitleBar :unlocked="S.phase === 'app'" />
      <AuthFlow v-if="S.phase === 'auth'" />
      <MainShell v-else-if="S.phase === 'app'" />
    </div>
  </UApp>
</template>

<style scoped>
.frame {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--hx-bg);
  color: var(--hx-ink);
}
</style>
