<script setup lang="ts">
import Logo from '../../components/Logo.vue'

defineProps<{ title: string; lead?: string; step?: number; logo?: boolean }>()
</script>

<template>
  <div class="shell">
    <div v-if="logo || step" class="top">
      <template v-if="logo">
        <Logo :size="28" />
        <span class="name">Hideout</span>
      </template>
      <span class="sp" />
      <div v-if="step" class="step" :aria-label="`Passo ${step} de 4`">
        <i v-for="i in 4" :key="i" :class="{ on: i <= step }" />
        <span>Passo {{ step }} de 4</span>
      </div>
    </div>
    <div class="intro">
      <h1>{{ title }}</h1>
      <p v-if="lead">{{ lead }}</p>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.shell {
  flex-grow: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px clamp(20px, 7vw, 40px) 26px;
}
.top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.name {
  font-weight: 700;
  font-size: 17px;
}
.sp {
  flex-grow: 1;
}
.step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--hx-muted);
  font-weight: 600;
}
.step i {
  width: 24px;
  height: 4px;
  border-radius: 2px;
  background: var(--hx-line);
}
.step i.on {
  background: var(--hx-primary);
}
.step span {
  margin-left: 4px;
}
.intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h1 {
  margin: 0;
  font-size: 25px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
p {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: var(--hx-muted);
}
</style>
