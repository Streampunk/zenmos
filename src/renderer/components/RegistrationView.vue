<template>
  <v-layout row>
    <v-flex>
      <v-card>
        <v-toolbar color="primary" dark dense>
          <v-toolbar-title>Resources</v-toolbar-title>
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