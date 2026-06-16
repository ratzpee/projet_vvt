<script setup>
</script>

<template>
  <nav class="global-nav">
    <RouterLink to="/">
      <span class="material-symbols-outlined">map</span>
    </RouterLink>
  </nav>
  <main>
    <RouterView />
  </main>
</template>

<style scoped>
main {
  height: 100vh;
  width: 100%;
  overflow: hidden;
}
</style>