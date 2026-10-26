<script setup lang="ts">
import { onMounted } from 'vue'
import { pt_br } from '@nuxt/ui/locale'
import { S, boot } from './store'
import TitleBar from './components/TitleBar.vue'
import AuthFlow from './views/auth/AuthFlow.vue'
import MainShell from './views/MainShell.vue'

onMounted(boot)
</script>

<template>
  <UApp :locale="pt_br" :toaster="{ position: 'bottom-center', duration: 2500, max: 2 }" :tooltip="{ delayDuration: 400 }">
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
