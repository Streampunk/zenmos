<template>
  <div id="app">
    <v-app dark>
      <v-navigation-drawer
        fixed
        :mini-variant="miniVariant"
        :clipped="clipped"
        v-model="drawer"
        app
      >
        <v-list>
          <v-list-tile 
            router
            :to="item.to"
            :key="i"
            v-for="(item, i) in items"
            exact
          >
            <v-list-tile-action>
              <v-icon v-html="item.icon"></v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title v-text="item.title"></v-list-tile-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-list>
      </v-navigation-drawer>
      <v-toolbar fixed app :clipped-left="clipped">
        <v-toolbar-side-icon @click.native.stop="drawer = !drawer"></v-toolbar-side-icon>
        <v-btn 
          icon
          @click.native.stop="miniVariant = !miniVariant"
        >
          <v-icon v-html="miniVariant ? 'chevron_right' : 'chevron_left'"></v-icon>
        </v-btn>
        <v-btn
          icon
          @click.native.stop="clipped = !clipped"
        >
          <v-icon>web</v-icon>
        </v-btn>
        <v-btn
          icon
          @click.native.stop="fixed = !fixed"
        >
          <v-icon>remove</v-icon>
        </v-btn>
        <v-toolbar-title v-text="title"></v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn
          icon
          @click.native.stop="rightDrawer = !rightDrawer"
        >
          <v-icon>menu</v-icon>
        </v-btn>
      </v-toolbar>
      <v-content>
        <v-container fluid fill-height>
          <v-slide-y-transition mode="out-in">
            <router-view></router-view>
          </v-slide-y-transition>
        </v-container>
      </v-content>
      <v-navigation-drawer
        temporary
        fixed
        :right="right"
        v-model="rightDrawer"
        app
      >
        <v-list>
          <v-list-tile @click.native="right = !right">
            <v-list-tile-action>
              <v-icon light>compare_arrows</v-icon>
            </v-list-tile-action>
            <v-list-tile-title>Switch drawer (click me)</v-list-tile-title>
          </v-list-tile>
        </v-list>
      </v-navigation-drawer>
      <v-footer :fixed="fixed" app>
        <v-spacer></v-spacer>
        <span>&copy; 2018</span>
      </v-footer>
    </v-app>
  </div>
</template>

<script>
  import createNodeRed from '../../nodeRed.js';
  import AuditList from './components/AuditList.vue';
  import RegistryList from './components/RegistryList.vue';

  export default {
    name: 'zenmos',
    data: () => ({
      clipped: false,
      drawer: true,
      fixed: false,
      items: [
        { icon: 'apps', title: 'Welcome', to: '/' },
        { icon: 'bubble_chart', title: 'Config', to: '/config' },
        { icon: 'assessment', title: 'Registration', to: '/registration' },
        { icon: 'message', title: 'Audit Log', to: '/audit' },
        { icon: 'tune', title: 'Node-RED', to: '/node-red' },
      ],
      miniVariant: false,
      right: true,
      rightDrawer: false,
      title: 'Zenmos',
      auditMsgs: [],
      store: [],
      latest: [],
    }),

    methods: {    
      auditConnect(cb) {
        cb(this.auditMsgs);
      },

      registryConnect(cb) {
        cb(this.regSet, this.regClear);
      },

      regSet(map, key, value) {
        const existing = this[map].findIndex(m => m.key === key);
        if (existing >= 0)
          this[map].splice(existing, 1);
        this[map].push({ key : key, value : value });
      },

      regClear(map) {
        this[map].clear();
      }
    },

    created: function () {
      createNodeRed(this.auditConnect, this.registryConnect);
      AuditList.methods.setConnect(() => this.auditMsgs);
      RegistryList.methods.setConnect(() => [ this.store, this.latest ]);
    },

  };
</script>

<style>
  @import url('https://fonts.googleapis.com/css?family=Roboto:300,400,500,700|Material+Icons');
  /* Global CSS */
</style>
