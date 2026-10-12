<template>
  <router-view></router-view>
</template>

<script setup></script>

<style lang="scss">
*::-webkit-scrollbar {
  width: 7px;
  display: none;
}

*::-webkit-scrollbar-thumb {
  border-radius: 8px;
  background-color: #03044a;
  display: none;
}

*::-webkit-scrollbar-track {
  display: none;
  border-radius: 8px;
  background-color: #03044a87;
  border: 1px solid #03044a87;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  width: 100vw;
  height: 100vh;
}
</style>
