<template>
  <div>
    <pre>{{JSON.stringify(item, null, 2)}}</pre>
  </div>
</template>

<script>
export default {
  props: ['item']
}
</script>
<style lang='less' scoped>
div {
  display: flex;
}

pre {
  flex: 1;
  width: 1px;
  overflow-x: auto;
}
</style>
