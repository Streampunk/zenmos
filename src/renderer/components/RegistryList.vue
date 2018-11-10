<template>
  <v-card>
    <v-card-title style="padding-top: 0px; padding-bottom: 7px">
      <v-spacer></v-spacer>
      <v-text-field
        append-icon="search"
        label="Search"
        single-line
        hide-details
        v-model="search"
      ></v-text-field>
    </v-card-title>
    <div class="scroll-container" style="max-height:300px">
      <v-container style="padding-top: 0px; padding-bottom: 0px">
        <v-data-table
          :headers="headers"
          :items="latest"
          item-key="key"
          hide-actions
          :search="search"
        >
          <template slot="items" slot-scope="props">
            <tr @click="itemSel(props.item)" v-bind:class="{ selected: selected == props.item }">
              <td v-bind:class="{ strikethrough: props.item.deleted }">{{ props.item.key }}</td>
              <td>{{ regTime(props.item.value.updateTime) }}</td>
              <td>{{ regTime(props.item.value.createdTime) }}</td>
              <td>{{ getVersion(props.item) }}</td>
              <td>{{ getQuantity(props.item) }}</td>
            </tr>
          </template>
        </v-data-table>
      </v-container>
    </div>
    <template v-if="msgStr">
      <v-divider></v-divider>
      <v-card>
        <v-card-text>
          <pre>{{ msgStr }}</pre>
        </v-card-text>
      </v-card>  
    </template>
  </v-card>
</template>

<script>
export default {
  data() {
    return {
      search: '',
      headers: [
        { text: 'ID', 
          align: 'left',
          sortable: false,
          value: 'key' },
        { text: 'Update time', value: 'updateTime' },
        { text: 'Created time', value: 'createdTime' },
        { text: 'Version', value: 'version' },
        { text: 'Qty', value: 'quantity' }
      ],
      selected: {},
      store: [],
      latest: []
    };
  },

  computed: {
    msgStr() {
      let str = '';
      const latestKeys = Object.keys(this.selected).filter(k => this.selected.hasOwnProperty(k));
      if (latestKeys.length) {
        const latestStoreKey = this.selected.deleted ? `${this.selected.key}_${this.selected.value.key.substring(10)}` : this.selected.value.key;
        const latestStoreObj = this.store.find(m => m.key === latestStoreKey); // the latest
        if (latestStoreObj) {
          const latestStoreKeys = Object.keys(latestStoreObj.value).filter(k => latestStoreObj.value.hasOwnProperty(k)).sort();
          let filtObj = {};
          latestStoreKeys.forEach(k => filtObj[k] = latestStoreObj.value[k]);
          str = JSON.stringify(filtObj, null, 2);
        }
      }
      return str;
    }
  },

  methods: {
    connect() { return [ [], [] ]; },
    setConnect(connect) {
      this.connect = connect;
    },

    regTime(ts) {
      return new Date(ts).toISOString().replace('T', ' ').substr(0, 19);
    },

    getVersion(item) {
      const storeKey = item.deleted ? `${item.key}_${item.value.key.substring(10)}` : item.value.key;
      const latestStoreObj = this.store.find(i => i.key === storeKey); // the latest
      return latestStoreObj ? latestStoreObj.value.version : '?';
    },

    getQuantity(item) {
      const allStoreObjs = this.store.filter(i => item.key === i.key.substring(0, i.key.lastIndexOf('_')));
      return allStoreObjs.length;
    },

    itemSel(item) {
      if (this.selected === item)
        this.selected = {};
      else
        this.selected = item;
    },

    isSel(item) {
      return this.selected === item;
    }
  },

  created: function () {
    [ this.store, this.latest ] = this.connect();
  }
};
</script>

<style scoped>
table.table thead tr { height: 28px }
table.table tbody td { height: 28px }
.scroll-container { overflow-y: scroll }
.container { max-width: 100% }
.selected { color: #40c4ff }
.strikethrough { text-decoration: line-through }
</style>
