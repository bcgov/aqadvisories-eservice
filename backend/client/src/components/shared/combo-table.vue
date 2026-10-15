<template>
  <div>
    <v-text-field append-icon="search" hint='Enter free style text for full text search or LoopBack <i>where filter</i> compatible JSON string for parametrized search, for example {"channel": "email"}.' label="Search" single-line hide-details v-model="search"></v-text-field>
    <v-data-table :headers="headers" :items="$store.state[this.model].items" class="elevation-1" :pagination.sync="pagination" :total-items="$store.state[this.model].totalCount" :loading="loading" :no-data-text="noDataText">
      <template slot="items" slot-scope="props">
        <slot :props='props' :viewItem='viewItem' :editItem='editItem' :deleteItem='deleteItem' />
      </template>
      <template slot="expand" slot-scope="props">
        <component :is='currentExpanderView' class='ma-2' @submit="submitEditPanel(props)" @cancel="cancelEditPanel(props)" :item='props.item' :schema='schema' :model='model' />
      </template>
      <template slot="footer">
        <td colspan="100%" class='pa-0'>
          <v-expansion-panel>
            <v-expansion-panel-content hide-actions v-model='newPanelExpanded'>
              <div slot="header" class='text-xs-center' color="indigo">
                <v-btn flat icon>
                  <v-icon large color="indigo">{{this.newPanelExpanded?'keyboard_arrow_up':'add'}}</v-icon>
                </v-btn>
              </div>
              <v-card>
                <v-card-text class="grey lighten-3">
                  <model-editor class='ma-2' @submit="submitNewPanel" @cancel="cancelNewPanel" :schema='schema' :model='model' />
                </v-card-text>
              </v-card>
            </v-expansion-panel-content>
          </v-expansion-panel>
        </td>
      </template>
    </v-data-table>
  </div>
</template>

<script>
import ModelEditor from './editor'
import ModelViewer from './viewer'
const NoDataText = 'No data available'
export default {
  components: {
    ModelEditor,
    ModelViewer
  },
  props: ['model', 'headers', 'schema'],
  computed: {
    accessToken:{
      get(){
        return this.$store.state.accessToken
      }
    },
    search: {
      get() {
        return this.$store.state[this.model].search
      },
      set(value) {
        this.$store.commit('setItemSearch', {
          model: this.model,
          value: value
        })
        let filter = {
          where: undefined
        }
        if (value !== '') {
          filter.where = {
            '$text': {
              search: value
            }
          }
          try {
            let searchJson = JSON.parse(value)
            if (searchJson instanceof Object) {
              filter.where = searchJson
            }
          } catch (ex) {}
          filter.skip = 0
          this.pagination.page = 1
        }
        this.fetchItems(filter)
      }
    }
  },
  methods: {
    fetchItems: async function(filter) {
      this.loading = true
      this.noDataText = NoDataText
      try {
        await this.$store.dispatch('fetchItems', {
          model: this.model,
          filter: filter
        })
      } catch (ex) {
        this.noDataText = 'Error getting data'
      }
      this.loading = false
    },
    editItem: function(props) {
      props.expanded = (this.currentExpanderView === 'modelEditor') ? !props.expanded : true
      this.currentExpanderView = 'modelEditor'
      this.$emit('inputFormExpanded')
    },
    viewItem: function(props) {
      props.expanded = (this.currentExpanderView === 'modelViewer') ? !props.expanded : true
      this.currentExpanderView = 'modelViewer'
    },
    submitEditPanel: function(props) {
      props.expanded = false
      this.$store.dispatch('fetchItems', {
        model: this.model,
        filter: {}
      })
    },
    cancelEditPanel: function(props) {
      props.expanded = false
    },
    submitNewPanel: function() {
      this.newPanelExpanded = false
      this.$store.dispatch('fetchItems', {
        model: this.model,
        filter: {}
      })
    },
    cancelNewPanel: function() {
      this.newPanelExpanded = false
    },
    deleteItem: async function(props) {
      await this.$store.dispatch('deleteItem', {
        model: this.model,
        item: props.item
      })
      await this.$store.dispatch('fetchItems', {
        model: this.model,
        filter: {}
      })
    }
  },
  watch: {
    pagination: {
      async handler() {
        let filter
        if (this.pagination.rowsPerPage >= -1) {
          filter = filter || {}
          if (this.pagination.rowsPerPage > 0) {
            filter.limit = this.pagination.rowsPerPage
            filter.skip = this.pagination.rowsPerPage * (this.pagination.page - 1)
          } else {
            filter.limit = undefined
            filter.skip = 0
          }
        }
        if (this.pagination.sortBy) {
          filter = filter || {}
          filter.order = this.pagination.sortBy + ' ' + (this.pagination.descending ? 'DESC' : 'ASC')
        }
        await this.fetchItems(filter)
        return
      },
      deep: true
    },
    newPanelExpanded: function(newVal) {
      newVal && this.$emit('inputFormExpanded')
    },
    accessToken: async function(newVal){
      await this.fetchItems(this.$store.state[this.model].filter)
    }
  },
  data: function() {
    return {
      newPanelExpanded: false,
      currentExpanderView: 'modelEditor',
      pagination: {},
      loading: true,
      noDataText: NoDataText
    }
  }
}
</script>
<style lang='less' scoped>
.table__overflow {
  overflow-x: visible;
  overflow-y: visible;
}
</style>

<style lang='less'>
.table__overflow .btn.btn--disabled {
  pointer-events: unset;
}
</style>
