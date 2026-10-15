<template>
  <div>
    <iframe id='nb-api-explorer' :src='ApiExplorerUrlPrefix' />
  </div>
</template>
<script>
import iFrameResize from 'iframe-resizer'
export default {
  data: function() {
    return {
      ApiExplorerUrlPrefix: window.ApiExplorerUrlPrefix || '/explorer',
      iFrameResizer: undefined
    }
  },
  mounted: async function() {
    $('#nb-api-explorer').iFrameResize({
      log: false
    })
    this.iFrameResizer = $('#nb-api-explorer')[0].iFrameResizer
  },
  beforeDestroy: function() {
    this.iFrameResizer && this.iFrameResizer.close()
  }
}
</script>
<style scoped>
iframe {
  min-width: 100%;
  width: 1px;
  border: none;
}
</style>
