<template>
  <div>
    <div id='nb-item-editor'></div>
    <v-btn color="primary" @click="setCurrentlyEditedItem">save</v-btn>
    <v-btn color="error" @click="resetEditor">cancel</v-btn>
  </div>
</template>

<script>
import 'json-editor'
import 'summernote'
export default {
  data: function() {
    return {
      jsonEditor: null,
      currentlyEditedItem: undefined
    }
  },
  props: ['item', 'schema', 'model'],
  methods: {
    setCurrentlyEditedItem: async function() {
      try {
        let item = this.jsonEditor.getValue()
        await this.$store.dispatch('setItem', {
          model: this.model,
          item: item
        })
        this.currentlyEditedItem = item
        this.$emit('submit')
      } catch (ex) {
        this.createJsonEditor()
      }
    },
    resetEditor: function() {
      this.createJsonEditor()
      this.$emit('cancel')
    },
    createJsonEditor: function() {
      let element = $('#nb-item-editor', this.$el).get(0)
      if (this.jsonEditor) {
        this.jsonEditor.destroy()
      }
      this.jsonEditor = new window.JSONEditor(element, {
        theme: 'bootstrap3',
        iconlib: 'fontawesome4',
        keep_oneof_values: false,
        required_by_default: false,
        // required: ['serviceName', 'channel', 'message'],
        remove_empty_properties: true,
        disable_collapse: true,
        startval: this.item,
        schema: this.schema
      })
    }
  },
  mounted: function() {
    this.createJsonEditor()
  },
  beforeDestroy: function() {
    this.jsonEditor && this.jsonEditor.destroy()
  }
}
</script>

<style lang='less'>
.datatable__expand-content:not(.v-leave-active) {
  height: auto!important;
}

#nb-item-editor {
  @import '~bootstrap/less/bootstrap.less';
  @import (less) '~summernote/dist/summernote.css';
  select {
    -webkit-appearance: menulist-button;
  }
  .btn {
    min-width: unset;
  }
}

// some divs created by summernote and jquery-ui are
// appended to body, creating extra empty bottom space
body {
  & > .note-popover.popover.bottom.in,
  & > .ui-helper-hidden-accessible {
    display: none;
  }
}
</style>
