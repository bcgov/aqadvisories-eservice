<template>
  <combo-table :headers='headers' :schema='schema' model='subscriptions'>
    <template slot-scope='props'>
      <tr>
        <td>{{ props.props.item.serviceName }}</td>
        <td>{{ props.props.item.channel }}</td>
        <td>{{ props.props.item.state }}</td>
        <td class='text-xs-right'>{{ props.props.item.updated }}</td>
        <td>
          <v-btn @click="props.viewItem(props.props)" flat icon>
            <v-icon>info</v-icon>
          </v-btn>
          <v-btn @click="props.editItem(props.props)" flat icon>
            <v-icon>create</v-icon>
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
        text: 'serviceName',
        align: 'left',
        value: 'serviceName'
      }, {
        text: 'channel',
        align: 'left',
        value: 'channel'
      }, {
        text: 'state',
        align: 'left',
        value: 'state'
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
          serviceName: {
            type: 'string',
            propertyOrder: 100
          },
          channel: {
            enum: ['email', 'sms'],
            type: 'string',
            propertyOrder: 200
          },
          userId: {
            type: 'string',
            propertyOrder: 250
          },
          userChannelId: {
            type: 'string',
            propertyOrder: 300
          },
          state: {
            type: 'string',
            enum: ['unconfirmed', 'confirmed', 'deleted'],
            propertyOrder: 800
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
