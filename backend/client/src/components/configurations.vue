<template>
  <combo-table :headers='headers' :schema='schema' model='configurations'>
    <template slot-scope='props'>
      <tr>
        <td>{{ props.props.item.name }}</td>
        <td>{{ props.props.item.serviceName }}</td>
        <td class='text-xs-right'>{{ props.props.item.updated }}</td>
        <td>
          <v-btn @click="props.viewItem(props.props)" flat icon>
            <v-icon>info</v-icon>
          </v-btn>
          <v-btn @click="props.editItem(props.props)" v-if="['dbSchemaVersion','rsa'].indexOf(props.props.item.name) < 0" flat icon>
            <v-icon>create</v-icon>
          </v-btn>
          <v-btn @click="props.deleteItem(props.props)" v-if="['dbSchemaVersion','rsa'].indexOf(props.props.item.name) < 0" flat icon>
            <v-icon color='red darken-2'>delete_forever</v-icon>
          </v-btn>
        </td>
      </tr>
    </template>
  </combo-table>
</template>

<script>
import ComboTable from './shared/combo-table'
export default {
  components: {
    ComboTable
  },
  data: function() {
    return {
      headers: [{
        text: 'name',
        align: 'left',
        value: 'name'
      }, {
        text: 'serviceName',
        align: 'left',
        value: 'serviceName'
      }, {
        text: 'updated',
        align: 'right',
        value: 'updated'
      }, {
        text: 'actions',
        align: 'left',
        sortable: false
      }],
      schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            options: {
              hidden: true
            }
          },
          name: {
            type: 'string',
            enum: ['notification', 'subscription'],
            propertyOrder: 100
          },
          serviceName: {
            type: 'string',
            propertyOrder: 200
          },
          value: {
            type: 'object',
            propertyOrder: 300
          },
          created: {
            type: 'string',
            options: {
              hidden: true
            }
          },
          updated: {
            type: 'string',
            options: {
              hidden: true
            }
          }
        }
      }
    }
  }
}
</script>
