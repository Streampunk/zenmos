<template>
  <v-card>
    <v-card-title>
      <v-spacer></v-spacer>
      <v-text-field
        append-icon="search"
        label="Search"
        single-line
        hide-details
        v-model="search"
      ></v-text-field>
    </v-card-title>
    <v-data-table
      :headers="headers"
      :items="msgs"
      item-key="sequence"
      :search="search"
    >
      <template slot="items" slot-scope="props">
        <tr @click="props.expanded = !props.expanded">
          <td>{{ props.item.sequence }}</td>
          <td>{{ msgTime(props.item.timestamp) }}</td>
          <td>{{ props.item.type }}</td>
        </tr>
      </template>
      <template slot="expand" slot-scope="props">
        <v-expansion-panel expand inset>
          <v-expansion-panel-content v-for="itemKey in msgObj(props.item)" :key="itemKey" ripple>
            <div slot="header">{{ itemKey }}</div>
            <v-card class="grey lighten-2">
              <v-card-text class="black--text">
                <pre>{{ msgStr(props.item, itemKey) }}</pre>
              </v-card-text>
            </v-card>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </template>
    </v-data-table>
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
      msgs: []
    };
  },
  methods: {
    connect() {},
    setConnect(connect) {
      this.connect = connect;
    },
    msgTime(ts) {
      return new Date(ts).toLocaleTimeString('en-US');
    },
    msgObj(msg) {
      return Object.keys(msg).filter(k => msg.hasOwnProperty(k)).sort();
    },
    msgStr(item, key) {
      if (('req' === key) || ('res' === key)) return '';
      return JSON.stringify(item[key], null, 2);
    }
  },
  created: function () {
    this.msgs = this.connect();
  }
};
</script>
