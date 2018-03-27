<template>
  <v-layout>
    <v-flex>
      <v-card>
        <v-card-media
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
        </v-card-media>
        <v-card-title>
          <div>
            <span class="subheading">
              For more information on ZeNMOS, check out the <a href="https://github.com/Streampunk/zenmos#README.md" target="_blank">documentation</a>. Find a bug? Report it on the github <a href="https://github.com/Streampunk/zenmos/issues" target="_blank" title="contribute">issue board</a>.
            </span>
          </div>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-actions class="pt-3 pb-3">
          <v-spacer></v-spacer>
          <v-btn class="link-btn" @click="open('https://github.com/AMWA-TV/nmos-discovery-registration')">AMWA IS-04</v-btn>
          <v-spacer></v-spacer>
          <v-btn class="link-btn" @click="open('https://github.com/Streampunk/zenmos#README.md')">ZeNMOS</v-btn>
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
  .centered
  {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .logo
  {
    max-width: 100%;
  }

  .link-btn
  {
    width: 150px;
  }
</style>
