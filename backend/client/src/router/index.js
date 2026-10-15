import Vue from 'vue'
import Router from 'vue-router'
import Home from '@/components/home'
import Subscriptions from '@/components/subscriptions'
import Notifications from '@/components/notifications'
import Configurations from '@/components/configurations'
import Administrators from '@/components/administrators'
import Bounces from '@/components/bounces'
import ApiExplorer from '@/components/api-explorer'

Vue.use(Router)

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '/',
      redirect: { name: 'Home' }
    },
    {
      path: '/home',
      name: 'Home',
      component: Home
    },
    {
      path: '/subscriptions',
      name: 'Subscriptions',
      component: Subscriptions
    },
    {
      path: '/notifications',
      name: 'Notifications',
      component: Notifications
    },
    {
      path: '/configurations',
      name: 'Configurations',
      component: Configurations
    },
    {
      path: '/administrators',
      name: 'Administrators',
      component: Administrators
    },
    {
      path: '/bounces',
      name: 'Bounces',
      component: Bounces
    },
    {
      path: '/api-explorer',
      name: 'API Explorer',
      component: ApiExplorer
    }
  ]
})
