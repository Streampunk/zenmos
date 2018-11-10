<template>
  <v-layout>
    <v-flex>
      <v-card>
        <v-img
          class="white--text"
          height="400px"
          src="static/streampunk.png"
        >
          <v-container fill-height fluid>
            <v-layout fill-height>
              <v-flex xs12 align-end flexbox>
                <span class="headline">Welcome to ZeNMOS - AMWA NMOS test application.</span>
              </v-flex>
            </v-layout>
          </v-container>
        </v-img>
        <v-divider></v-divider>
        <v-card-actions class="pt-3 pb-3">
          <v-spacer></v-spacer>
          <v-btn class="link-btn" color="primary" @click="open('https://github.com/Streampunk/zenmos#README.md')">ZeNMOS
            <v-icon dark right>launch</v-icon>
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn class="link-btn" color="primary" @click="open('https://github.com/AMWA-TV/nmos-discovery-registration')">AMWA IS-04
            <v-icon dark right>launch</v-icon>
          </v-btn>
          <v-spacer></v-spacer>
        </v-card-actions>
      </v-card>
    </v-flex>
  </v-layout>
</template>

<script>
  export default {
    name: 'welcome',
    methods: {
      open (link) {
        this.$electron.shell.openExternal(link);
      }
    }
  };
</script>

<style scoped>
  .link-btn
  {
    width: 150px;
  }
</style>
