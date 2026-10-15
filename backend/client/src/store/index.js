import Vue from 'vue'
import Vuex from 'vuex'
import axios from 'axios'

Vue.use(Vuex)

const ApiUrlPrefix = window.ApiUrlPrefix || '/api'
export default new Vuex.Store({
  state: {
    notifications: {
      items: [],
      filter: undefined,
      totalCount: undefined,
      search: undefined
    },
    subscriptions: {
      items: [],
      filter: undefined,
      totalCount: undefined,
      search: undefined
    },
    configurations: {
      items: [],
      filter: undefined,
      totalCount: undefined,
      search: undefined
    },
    administrators: {
      items: [],
      filter: undefined,
      totalCount: undefined,
      search: undefined
    },
    bounces: {
      items: [],
      filter: undefined,
      totalCount: undefined,
      search: undefined
    },
    accessToken: localStorage.getItem('swagger_accessToken')
  },
  mutations: {
    setLocalItems(state, payload) {
      state[payload.model].items = payload.items
    },
    setTotalItemCount(state, payload) {
      state[payload.model].totalCount = payload.cnt
    },
    setItemFilter(state, payload) {
      state[payload.model].filter = payload.filter
    },
    setItemSearch(state, payload) {
      state[payload.model].search = payload.value
    },
    setAccessToken(state, payload) {
      if (payload && payload.length > 0) {
        localStorage.setItem('swagger_accessToken', payload)
      } else {
        localStorage.removeItem('swagger_accessToken')
        payload = undefined
      }
      state['accessToken'] = payload
    }
  },
  actions: {
    async setItem({ state }, payload) {
      let id,
        method = 'post',
        item = payload.item
      if (item.id) {
        id = item.id
        method = 'put'
        delete item.id
        delete item.updated
        delete item.created
      }
      let req = {
        method: method,
        url: ApiUrlPrefix + '/' + payload.model + (id ? '/' + id : ''),
        data: item
      }
      let accessToken = state['accessToken']
      if (accessToken) {
        req.headers = {
          Authorization: accessToken
        }
      }
      await axios(req)
    },
    async deleteItem({ state }, payload) {
      let req = {
        method: 'delete',
        url: ApiUrlPrefix + '/' + payload.model + '/' + payload.item.id
      }
      let accessToken = state['accessToken']
      if (accessToken) {
        req.headers = {
          Authorization: accessToken
        }
      }
      await axios(req)
    },
    async fetchItems({ commit, state }, payload) {
      let filter = payload.filter
      if (filter) {
        filter = Object.assign({}, state[payload.model].filter, filter)
      } else {
        commit('setItemSearch', { model: payload.model })
      }
      commit('setItemFilter', {
        model: payload.model,
        filter: filter
      })
      let url = ApiUrlPrefix + '/' + payload.model
      if (filter) {
        url += '?filter=' + encodeURIComponent(JSON.stringify(filter))
      }
      let req = {
        url: url
      }
      let accessToken = state['accessToken']
      if (accessToken) {
        req.headers = {
          Authorization: accessToken
        }
      }
      let items
      try {
        items = await axios(req)
      } catch (ex) {
        commit('setLocalItems', { model: payload.model, items: [] })
        commit('setTotalItemCount', { model: payload.model, cnt: undefined })
        throw ex
      }
      commit('setLocalItems', { model: payload.model, items: items.data })
      url = ApiUrlPrefix + '/' + payload.model + '/count'
      if (filter && filter.where) {
        url += '?where=' + encodeURIComponent(JSON.stringify(filter.where))
      }
      req = {
        url: url
      }
      if (accessToken) {
        req.headers = {
          Authorization: accessToken
        }
      }
      let response = await axios(req)
      commit('setTotalItemCount', {
        model: payload.model,
        cnt: response.data.count
      })
    },
    async getSubscribedServiceNames() {
      let url = ApiUrlPrefix + '/subscriptions/services'
      let req = {
        url: url
      }
      let accessToken = state['accessToken']
      if (accessToken) {
        req.headers = {
          Authorization: accessToken
        }
      }
      let res = await axios(req)
      return res.data
    }
  },
  strict: process.env.NODE_ENV !== 'production'
})
