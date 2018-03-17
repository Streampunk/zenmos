<template>
  <v-layout row>
    <v-flex>
      <v-card>
        <v-toolbar color="light-blue" dark dense>
          <v-toolbar-side-icon></v-toolbar-side-icon>
          <v-toolbar-title>Audit View</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon>
            <v-icon>more_vert</v-icon>
          </v-btn>
        </v-toolbar>
        <AuditList/>
      </v-card>
    </v-flex>
  </v-layout>
</template>

<script>
  import AuditList from './AuditList.vue';
  export default {
    name: 'AuditView',
    components: {
      AuditList
    },
  };
</script>

<style scoped>

</style>