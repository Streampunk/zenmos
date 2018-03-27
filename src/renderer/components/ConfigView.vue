<template>
  <v-layout row>
    <v-flex>
      <v-card>
        <v-toolbar color="light-blue" dark dense>
          <v-toolbar-title>Configuration</v-toolbar-title>
        </v-toolbar>
        <v-card-title>
          <v-dialog v-model="dialog" max-width="500px">
            <v-btn color="primary" dark slot="activator" class="mb-2">Save Current Flow</v-btn>
            <v-card>
              <v-card-title>
                <span class="headline">Save Current Flow</span>
              </v-card-title>
              <v-card-text>
                <v-container grid-list-md>
                  <v-layout column>
                    <v-text-field label="Filename" v-model="saveCurFlow.filename" counter=20 :rules="[max20chars]"></v-text-field>
                    <v-text-field label="Description" v-model="saveCurFlow.description" counter=50 :rules="[max50chars]"></v-text-field>
                  </v-layout>
                </v-container>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="blue darken-1" flat @click.native="close">Cancel</v-btn>
                <v-btn color="blue darken-1" flat @click.native="save">Save</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
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
            <template v-if="props.item.template === false">
             <td>flow</td>
            </template>
            <template v-else>
             <td>template</td>
            </template>
            <td>{{ props.item.modDate }}</td>
            <template v-if="props.item.template === false">
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
            </template>
            <template v-else>
              <td>{{ props.item.description }}</td>
            </template>
            <td class="justify-center layout px-0">
              <v-btn icon class="mx-0" @click="deployFlow(props.item)">
                <v-icon color="teal">update</v-icon>
              </v-btn>
              <template v-if="props.item.template === false">
                <v-btn icon class="mx-0" @click="deleteFlow(props.item)">
                  <v-icon color="pink">delete</v-icon>
                </v-btn>
              </template>
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
  const templateFlowsPath = process.env.NODE_ENV !== 'development' ? 
    path.join(__dirname, '..', '..', 'flows') : 
    'flows';

  import nrc from './nodeRedConfig.js';
  export default {
    name: 'ConfigView',
    data: () => ({
      max20chars: (v) => v.length <= 20 || 'Input too long!',      
      max50chars: (v) => v.length <= 50 || 'Input too long!',      
      dialog: false,
      search: '',
      headers: [
        {
          text: 'Filename',
          align: 'left',
          sortable: true,
          value: 'filename'
        },
        { text: 'Type', value: 'template' },
        { text: 'Date modified', value: 'modDate' },
        { text: 'Description', value: 'description' },
        { text: 'Actions', value: 'name', sortable: false, align: 'center' }
      ],
      flows: [],
      saveCurFlow: {
        filename: '',
        description: ''
      },
    }),

    methods: {
      addFlowEntry(filepath) {
        const parsed = path.parse(filepath);
        const modDate = fs.statSync(filepath).mtime.toLocaleTimeString('en-US');
        const flow = {
          filepath: filepath,
          filename: parsed.name,
          modDate: modDate,
          description: 'None - click to edit',
          template: templateFlowsPath === parsed.dir
        };
        fs.readFile(filepath, (err, data) => {
          if (err)
            flow.description = 'Failed to read file data';
          else {
            try {
              flow.flowObj = JSON.parse(data.toString());
              const tab = flow.flowObj.find(f => 'tab' === f.type);
              if (tab && tab.info)
                flow.description = tab.info;
              this.flows.push(flow);
            } catch(e) {
              console.log(`Failed to parse flow file ${flow.filename}: ${e}`);
            }
          }
        });
      },

      readFlowsDir(sourcePath) {
        fs.readdir(sourcePath, (err, files) => {
          if (err)
            console.log(`Failed to read flows from ${sourcePath} - ${err}`);
          else
            files.forEach(f => this.addFlowEntry(path.join(sourcePath, f)));
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

      close() {
        this.dialog = false;
        this.saveCurFlow.filename = '';
        this.saveCurFlow.description = '';
        this.saveCurFlow.flow = {};
      },

      save() {
        const tab = this.saveCurFlow.flow.find(f => 'tab' === f.type);
        tab.label = this.saveCurFlow.filename;
        tab.info = this.saveCurFlow.description;
        fs.writeFile(path.join(flowsPath, `${this.saveCurFlow.filename}.json`), JSON.stringify(this.saveCurFlow.flow), err => {
          if (err)
            console.log('writeFile error:', err);
        });
        this.close();
      },
    },

    watch: {
      dialog (val) {
        if (val) {
          nrc.getActiveFlow((err, flow) => {
            if (err) {
              console.log('Failed to read current flow from Node-RED -', err);
              this.close();
            }
            else {
              this.saveCurFlow.flow = flow;
              const tab = flow.find(f => 'tab' === f.type);
              this.saveCurFlow.filename = tab.label;
              this.saveCurFlow.description = tab.info;
            }
          });
        }
        else
          this.close();
      }
    },

    created: function () {
      this.flows.splice(0);
      this.readFlowsDir(flowsPath);
      this.readFlowsDir(templateFlowsPath);

      fs.watch(flowsPath, {persistent: false}, (eventType, filename) => {
        if (filename && ('rename' === eventType)) {
          const filepath = path.join(flowsPath, filename);
          const index = this.flows.findIndex(f => f.filepath === filepath);
          if (index >= 0)
            this.flows.splice(index, 1);
          if (fs.existsSync(filepath))
            this.addFlowEntry(filepath);
        } else if (!filename) {
          console.log('Flows directory watcher failed to send filename');
          this.readFlowsDir();
        }
      });
    }
  };
</script>

<style scoped>

</style>