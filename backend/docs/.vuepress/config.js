const { description } = require('../package');

module.exports = {
  base: `/NotifyBC${process.env.notifyBCDocVersion_PATH || '/'}`,
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#title
   */
  title: 'NotifyBC',
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#description
   */
  description: description,

  /**
   * Extra tags to be injected to the page HTML `<head>`
   *
   * ref：https://v1.vuepress.vuejs.org/config/#head
   */
  head: [
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    [
      'meta',
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }
    ],
    ['link', { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
  ],

  /**
   * Theme configuration, here is the default theme configuration for VuePress.
   *
   * ref：https://v1.vuepress.vuejs.org/theme/default-theme-config.html
   */
  themeConfig: {
    repo: 'bcgov/NotifyBC',
    logo: '/img/logo.svg',
    editLinks: false,
    docsDir: '',
    editLinkText: '',
    lastUpdated: false,
    nav: [
      {
        text: 'Home',
        link: '/'
      },
      {
        text: 'Docs',
        link: '/docs/'
      },
      {
        text: 'Help',
        link: '/help/'
      }
    ],
    sidebar: {
      '/docs/': [
        {
          title: 'Getting Started',
          collapsable: false,
          children: [
            'getting-started/',
            'getting-started/overview',
            'getting-started/quickstart',
            'getting-started/installation',
            'getting-started/usage'
          ]
        },
        {
          title: 'Configuration',
          collapsable: false,
          children: [
            'config/overview',
            'config/adminIpList',
            'config/reverseProxyIpLists',
            'config/httpHost',
            'config/smtp',
            'config/sms',
            'config/subscription',
            'config/notification',
            'config/database',
            'config/nodeRoles',
            'config/cronJobs',
            'config/rsaKeys',
            'config/internalHttpHost',
            'config/inboundSmtpServer',
            'config/listUnsubscribeByEmail',
            'config/notificationBounce',
            'config/workerProcessCount'
          ]
        },
        {
          title: 'API',
          collapsable: false,
          children: [
            'api/overview',
            'api/subscription',
            'api/notification',
            'api/config',
            'api/administrator',
            'api/bounce'
          ]
        },
        {
          title: 'Miscellaneous',
          collapsable: false,
          children: [
            'miscellaneous/benchmarks',
            'miscellaneous/bulk-import',
            'miscellaneous/developer-notes'
          ]
        },
        { title: 'Meta', collapsable: false, children: ['meta/conduct'] }
      ]
    },
    algolia: {
      apiKey: process.env.ALGOLIA_API_Key,
      indexName: 'notifybc'
    }
  },

  /**
   * Apply plugins，ref：https://v1.vuepress.vuejs.org/zh/plugin/
   */
  plugins: [
    '@vuepress/plugin-back-to-top',
    '@vuepress/plugin-medium-zoom',
    '@dovyp/vuepress-plugin-clipboard-copy'
  ]
};
