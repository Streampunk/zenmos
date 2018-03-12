<template>
  <v-layout row justify-center>
    <v-card>
      <v-toolbar color="light-blue" dark dense>
        <v-toolbar-side-icon></v-toolbar-side-icon>
        <v-toolbar-title>Node-RED</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon>
          <v-icon>more_vert</v-icon>
        </v-btn>
      </v-toolbar>
      <webview id="node-red" src="http://127.0.0.1:8000/red" allowpopups style="display:inline-flex; width:80vw; height:90vh"></webview>
    </v-card>
  </v-layout>
</template>

<style scoped>
</style>