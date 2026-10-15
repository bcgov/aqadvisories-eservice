<template>
  <combo-table :headers='headers' :schema='schema' model='bounces'>
    <template slot-scope='props'>
      <tr>
        <td>{{ props.props.item.userChannelId }}</td>
        <td class='text-xs-right'>{{ props.props.item.hardBounceCount }}</td>
        <td>{{ props.props.item.state }}</td>
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
      headers: [
        {
          text: 'userChannelId',
          align: 'left',
          value: 'userChannelId'
        },
        {
          text: 'hardBounceCount',
          align: 'right',
          value: 'hardBounceCount'
        },
        {
          text: 'state',
          align: 'left',
          value: 'state'
        },
        {
          text: 'updated',
          align: 'right',
          value: 'updated'
        },
        {
          text: 'actions',
          align: 'left',
          sortable: false
        }
      ],
      schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            options: {
              hidden: true
            }
          },
          channel: {
            type: 'string',
            enum: ['email', 'sms'],
            propertyOrder: 50
          },
          userChannelId: {
            type: 'string',
            propertyOrder: 100
          },
          hardBounceCount: {
            type: 'integer',
            propertyOrder: 150
          },
          state: {
            type: 'string',
            enum: ['active', 'deleted'],
            propertyOrder: 200
          },
          bounceMessages: {
            type: 'array',
            format: 'tabs',
            items: {
              type: 'object',
              properties: {
                date: {
                  type: 'string',
                  format: 'datetime',
                  description:
                    'use format yyyy-mm-ddThh:mm:ss.fffZ, ok to truncate minor parts. Examples 2017-10-23T17:53:44.502Z or 2017-10-23'
                },
                message: {
                  type: 'string'
                }
              }
            },
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
