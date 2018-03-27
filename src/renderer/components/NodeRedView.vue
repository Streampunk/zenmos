<template>
  <v-layout row justify-center>
    <v-card>
      <v-toolbar color="light-blue" dark dense>
        <v-toolbar-title>Node-RED</v-toolbar-title>
      </v-toolbar>
      <webview id="node-red" src="http://127.0.0.1:8000" allowpopups style="display:inline-flex; width:95vw; height:80vh"></webview>
    </v-card>
  </v-layout>
</template>

<style scoped>
</style>