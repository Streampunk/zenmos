<template>
  <v-layout row>
    <v-flex>
      <v-card>
        <v-toolbar color="light-blue" dark dense>
          <v-toolbar-title>Configuration</v-toolbar-title>
        </v-toolbar>
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
          :items="flows"
          item-key="filename"
          :search="search"
        >
          <template slot="items" slot-scope="props">
            <td>{{ props.item.filename }}</td>
            <td>{{ props.item.modDate }}</td>
            <td>
              <v-edit-dialog
                :return-value.sync="props.item.description"
                large
                lazy
                persistent
              > <div>{{ props.item.description }}</div>
                <div slot="input" class="mt-3 title">Update Description</div>
                <v-text-field
                  slot="input"
                  label="Edit"
                  v-model="props.item.description"
                  single-line
                  counter=50
                  autofocus
                  :rules="[max50chars]"
                  @change="updateDescription(props.item)"
                ></v-text-field>
              </v-edit-dialog>
            </td>
            <td class="justify-center layout px-0">
              <v-btn icon class="mx-0" @click="deployFlow(props.item)">
                <v-icon color="teal">update</v-icon>
              </v-btn>
              <v-btn icon class="mx-0" @click="deleteFlow(props.item)">
                <v-icon color="pink">delete</v-icon>
              </v-btn>
            </td>
          </template>
        </v-data-table>
      </v-card>
    </v-flex>
  </v-layout>
</template>

<script>
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const basePath = 'darwin' === os.platform() ?
    path.join(process.env.HOME, 'Library', 'zenmos') :
    path.join(process.env.APPDATA, 'zenmos');
  const flowsPath = path.join(basePath, 'reduser', 'lib', 'flows');

  import nrc from './nodeRedConfig.js';
  export default {
    name: 'ConfigView',
    data: () => ({
      max50chars: (v) => v.length <= 50 || 'Input too long!',      
      search: '',
      headers: [
        {
          text: 'Filename',
          align: 'left',
          sortable: true,
          value: 'filename'
        },
        { text: 'Date modified', value: 'modDate' },
        { text: 'Description', value: 'description' },
        { text: 'Actions', value: 'name', sortable: false, align: 'center' }
      ],
      flows: [],
    }),

    methods: {
      makeFlowEntry(filepath) {
        const parsed = path.parse(filepath);
        const modDate = fs.statSync(filepath).mtime.toLocaleTimeString('en-US');
        const flow = {
          filepath: filepath,
          filename: parsed.name,
          modDate: modDate,
          description: 'None - click to edit'
        };
        fs.readFile(filepath, (err, data) => {
          if (err)
            flow.description = 'Failed to read file data';
          else {
            flow.flowObj = JSON.parse(data.toString());
            const tab = flow.flowObj.find(f => 'tab' === f.type);
            if (tab && tab.info)
              flow.description = tab.info;
          }
        });
        return flow;
      },

      readFlowsDir() {
        this.flows.splice(0);
        fs.readdir(flowsPath, (err, files) => {
          if (err)
            console.log(`Failed to read flows from ${flowsPath} - ${err}`);
          else {
            files.forEach(f => {
              const filepath = path.join(flowsPath, f);
              this.flows.push(this.makeFlowEntry(filepath));
            });
          }
        });
      },

      updateDescription(flow) {
        let tab = flow.flowObj.find(f => 'tab' === f.type);
        if (tab) {
          tab.info = flow.description;
        } else {
          const id = (1+Math.random()*4294967295).toString(16);
          tab = {
            id: id,
            type: 'tab',
            label: flow.filename,
            info: flow.description
          };
          flow.flowObj.forEach(n => n.z = id);
          flow.flowObj.unshift(tab);
        }
        fs.writeFile(flow.filepath, JSON.stringify(flow.flowObj), err => {
          if (err)
            console.log('writeFile error:', err);
        });
      },

      deployFlow(flow) {
        nrc.setActiveFlow(flow.flowObj);
      },

      deleteFlow(flow) {
        const index = this.flows.indexOf(flow);
        confirm('Are you sure you want to delete this flow?') && fs.unlink(this.flows[index].filepath, () => {});
      },
    },

    created: function () {
      this.readFlowsDir();
      fs.watch(flowsPath, {persistent: false}, (eventType, filename) => {
        if (filename && ('rename' === eventType)) { // rename => something has appeared or disappeared
          const filepath = path.join(flowsPath, filename);
          const index = this.flows.findIndex(f => f.filepath === filepath);
          if (index >= 0)
            this.flows.splice(index, 1);
          if (fs.existsSync(filepath))
            this.flows.push(this.makeFlowEntry(filepath));
        } else if (!filename) {
          console.log('Flows directory watcher failed to send filename');
          this.readFlowsDir();
        }
      });

      // nrc.getActiveFlow((err, flow) => {
      //   if (err)
      //     console.log('Failed to read current flow from Node-RED -', err);
      //   else {
      //     const curFlowFile = this.flows.find(f => JSON.stringify(f.flowObj) === JSON.stringify(flow));
      //     if (curFlowFile)
      //       console.log('Found it');
      //   }
      // });
    }
  };
</script>

<style scoped>

</style>