<template>
  <div>
    <h6>Welcome</h6>
    <p>If you are a NotifyBC administrator, you can manage following items in curated web console UI
      <ul>
        <li><router-link to="/subscriptions">Subscriptions</router-link></li>
        <li><router-link to="/notifications">Notifications</router-link></li>
        <li><router-link to="/configurations">Configurations</router-link></li>
        <li><router-link to="/administrators">Administrators</router-link></li>
        <li><router-link to="/bounces">Bounces</router-link></li>
      </ul>
    </p>
    <p>
      Alternatively, use <router-link to="/api-explorer">API Explorer</router-link> to manipulate raw JSON object through REST API for maximum flexibility.</p>
  </div>
</template>

<script>
export default {}
</script>

<style scoped>
</style>
