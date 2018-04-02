<template>
  <v-card>
    <v-card-title style="align-items: baseline; padding-top: 0px; padding-bottom: 0px">
      <v-btn color="secondary" dark @click="clearAll()">Clear All</v-btn>
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
          :items="msgs"
          item-key="sequence"
          hide-actions
          :search="search"
        >
          <template slot="items" slot-scope="props">
            <tr @click="itemSel(props.item)" v-bind:class="{ selected: selected == props.item }">
              <td>{{ props.item.sequence }}</td>
              <td>{{ msgTime(props.item.timestamp) }}</td>
              <td>{{ props.item.type }}</td>
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
        {
          text: 'Sequence',
          align: 'left',
          sortable: false,
          value: 'sequence'
        },
        { text: 'Time', value: 'timestamp' },
        { text: 'Type', value: 'type' }
      ],
      selected: {},
      msgs: []
    };
  },

  computed: {
    msgStr() {
      let str = '';
      const keys = Object.keys(this.selected).filter(k => this.selected.hasOwnProperty(k));
      if (keys.length) {
        let filtObj = {};
        keys.sort()
          .filter(k => ('req' !== k) && ('res' !== k) && ('_' !== k[0]))
          .forEach(k => filtObj[k] = this.selected[k]);
        str = JSON.stringify(filtObj, null, 2);
      } 
      return str;
    }
  },

  methods: {
    connect() {},
    setConnect(connect) {
      this.connect = connect;
    },

    msgTime(ts) {
      return new Date(ts).toISOString().replace('T', ' ').substr(0, 23);
    },

    itemSel(item) {
      if (this.selected === item)
        this.selected = {};
      else
        this.selected = item;
    },

    clearAll() {
      this.msgs.splice(0);
    }
  },

  created: function () {
    this.msgs = this.connect();
  }
};
</script>

<style scoped>
table.table thead tr { height: 28px }
table.table tbody td { height: 28px }
.scroll-container { overflow-y: scroll }
.container { max-width: 100% }
tr.selected { color: #40c4ff }
</style>
