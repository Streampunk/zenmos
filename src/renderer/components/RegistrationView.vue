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
      </v-card>
    </v-flex>
  </v-layout>
</template>

<script>
  export default {
    name: 'Registration',
    data () {
      return {
        resources: [
          { type: 'Node', active: false, error: false, instances: [] },
          { type: 'Device', active: false, error: false, instances: [] },
          { type: 'Receiver', active: false, error: false, instances: [] },
          { type: 'Sender', active: false, error: false, instances: [] },
          { type: 'Source', active: false, error: false, instances: [] },
          { type: 'Flow', active: false, error: false, instances: [] }
        ],
        dialog: false
      };
    },

    methods: {
      click () {

      },
      addResource (resourceType, newRes) {
        const resource = this.resources.find(r => r.type === resourceType);
        resource.instances.unshift(newRes);
        resource.error = resource.instances.reduce((acc, cur) => acc || cur.error, false);
      },
      updateResource (/*resourceType, updRes */) {

      },
      deleteResource (resourceType, resourceID) {
        const resource = this.resources.find(r => r.type === resourceType);
        const index = resource.instances.findIndex(i => i.id === resourceID);
        if (index >= 0) resource.instances.splice(index, 1);
        resource.error = resource.instances.reduce((acc, cur) => acc || cur.error, false);
      }
    }
  };
</script>

<style scoped>

</style>