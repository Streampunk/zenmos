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
      :items="latest"
      item-key="key"
      :search="search"
    >
      <template slot="items" slot-scope="props">
        <tr @click="props.expanded = !props.expanded">
          <td>{{ props.item.key }}</td>
          <td>{{ regTime(props.item.value.updateTime) }}</td>
          <td>{{ regTime(props.item.value.createdTime) }}</td>
        </tr>
      </template>
      <template slot="expand" slot-scope="props">
        <v-expansion-panel expand inset>
          <v-expansion-panel-content v-for="itemKey in regObj(props.item)" :key="itemKey" ripple>
            <div slot="header">{{ itemKey }}</div>
            <v-card class="grey lighten-2">
              <v-card-text class="black--text">
                <pre>{{ regStr(props.item, itemKey) }}</pre>
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
        { text: 'ID', 
          align: 'left',
          sortable: false,
          value: 'key' },
        { text: 'Update time', value: 'updateTime' },
        { text: 'Created time', value: 'createdTime' }
      ],
      store: [],
      latest: []
    };
  },
  methods: {
    connect() { return [ [], [] ]; },
    setConnect(connect) {
      this.connect = connect;
    },

    regTime(ts) {
      return new Date(ts).toLocaleTimeString('en-US');
    },

    regObj(item) {
      let result = [];
      const reg = this.store.find(m => m.key === item.value.key); // the latest
      if (reg)
        result = Object.keys(reg.value).filter(k => reg.value.hasOwnProperty(k)).sort();

      // const oldRegs = this.store.filter(m => m.key.slice(0, m.key.lastIndexOf('_')) === item.key);
      // console.log('Old versions:', oldRegs);

      return result;
    },

    regStr(item, key) {
      let result = '';
      const reg = this.store.find(m => m.key === item.value.key);
      if (reg)
        result = JSON.stringify(reg.value[key], null, 2);
      return result;
    }
  },

  created: function () {
    [ this.store, this.latest ] = this.connect();
  }
};
</script>
