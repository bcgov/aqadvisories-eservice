<template>
  <v-app id="inspire">
    <v-navigation-drawer persistent v-model="drawer" enable-resize-watcher app>
      <v-list dense>
        <v-list-tile to="/home">
          <v-list-tile-action>
            <v-icon>home</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>Home</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile to="/subscriptions/">
          <v-list-tile-action>
            <v-icon>list</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>Subscriptions</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile to="/notifications/">
          <v-list-tile-action>
            <v-icon>email</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>Notifications</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile to="/configurations/">
          <v-list-tile-action>
            <v-icon>settings_applications</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>Configurations</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile to="/administrators/">
          <v-list-tile-action>
            <v-icon>security</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>Administrators</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile to="/bounces/">
          <v-list-tile-action>
            <v-icon>report</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>Bounces</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile to="/api-explorer/">
          <v-list-tile-action>
            <v-icon>code</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>API Explorer</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
      </v-list>
    </v-navigation-drawer>
    <v-toolbar color="indigo" dark app>
      <v-toolbar-side-icon @click.stop="drawer = !drawer"></v-toolbar-side-icon>
      <v-toolbar-title>NotifyBC Web Console - {{ this.$router.currentRoute.name }}</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items class="center-text">
        <div class="mr-1">Access Token</div>
        <v-text-field dark single-line hide-details v-model="accessToken"></v-text-field>
      </v-toolbar-items>
    </v-toolbar>
    <main>
      <v-content>
        <v-container fluid>
          <router-view></router-view>
        </v-container>
      </v-content>
    </main>
    <v-footer color="indigo" app>
      <span class="white--text">
        &copy; 2016-present under the terms of
        <a
          href="https://github.com/bcgov/NotifyBC/blob/master/LICENSE"
          target="_"
        >Apache License, Version 2.0</a>
      </span>
    </v-footer>
  </v-app>
</template>

<script>
export default {
  name: 'app',
  data: () => ({
    drawer: true
  }),
  props: {
    source: String
  },
  computed: {
    accessToken: {
      get() {
        return this.$store.state.accessToken
      },
      set(value) {
        this.$store.commit('setAccessToken', value)
      }
    }
  }
}
</script>

<style scoped lang='less'>
.white--text a {
  color: white !important;
}
.center-text {
  align-items: center;
}
</style>
