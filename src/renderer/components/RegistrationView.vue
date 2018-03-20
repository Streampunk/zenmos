<template>
  <v-layout row>
    <v-flex>
      <v-card>
        <v-toolbar color="light-blue" dark dense>
          <v-toolbar-side-icon></v-toolbar-side-icon>
          <v-toolbar-title>Resources</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon>
            <v-icon>more_vert</v-icon>
          </v-btn>
        </v-toolbar>
        <RegistryList/>
      </v-card>
    </v-flex>
  </v-layout>
</template>

<script>
  import RegistryList from './RegistryList.vue';
  export default {
    name: 'RegistryView',
    components: {
      RegistryList
    },
  };
</script>

<style scoped>

</style>