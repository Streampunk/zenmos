<template>
  <v-data-table
    :headers="headers"
    :items="msgs"
    hide-actions
    item-key="sequence"
  >
    <template slot="items" slot-scope="props">
      <tr @click="props.expanded = !props.expanded">
        <td>{{ props.item.sequence }}</td>
        <td>{{ msgTime(props.item.timestamp) }}</td>
        <td>{{ props.item.type }}</td>
      </tr>
    </template>
    <template slot="expand" slot-scope="props">
      <v-card class="grey lighten-1">
        <v-card-text class="black--text">
          <pre>{{ msgStr(props.item) }}</pre>
        </v-card-text>
      </v-card>
    </template>
  </v-data-table>
</template>

<script>
export default {
  data() {
    return {
      headers: [
        {
          text: '#',
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
    msgStr(msg) {
      return JSON.stringify(msg, null, 2);
    }  
  },
  created: function () {
    this.msgs = this.connect();
  }
};
</script>
