<template>
  <combo-table :headers='headers' :schema='schema' model='administrators'>
    <template slot-scope='props'>
      <tr>
        <td>{{ props.props.item.email }}</td>
        <td class='text-xs-right'>{{ props.props.item.updated }}</td>
        <td>
          <v-btn @click="props.viewItem(props.props)" flat icon>
            <v-icon>info</v-icon>
          </v-btn>
          <v-btn @click="props.editItem(props.props)" flat icon>
            <v-icon>create</v-icon>
          </v-btn>
          <v-btn @click="props.deleteItem(props.props)" flat icon>
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
        text: 'email',
        align: 'left',
        value: 'email'
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
          email: {
            type: 'string',
            propertyOrder: 100
          },
          password: {
            type: 'string',
            propertyOrder: 200
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
