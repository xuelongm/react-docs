
const path = require('path');

module.exports = {
    title: 'React Docs',
    description: 'docs React 17x',
    configureWebpack: {
        resolve: {
            alias: {
                '@assets': path.join(__dirname, '..', '..', 'assets')
            }
        }
    },
    themeConfig: {
        nav: [
            { text: 'Home', link: '/' },
        ],
        sidebar: [
            '/',
            '/concept',
            {
                title: 'render',
                children: [
                    '/render/overview',
                    '/render/capture',
                    '/render/bubble'
                ]
            },
            {
                title: 'commit',
                children: [
                    './commit/commit'
                ]
            },
            {
                title: 'diff',
                children: [
                    '/diff/diff'
                ]
            },
            {
                title: '状态更新',
                children: [
                    '/state/state.md'
                ]
            }

        ],
        lastUpdated: 'Last Updated',
        smoothScroll: true,
    },
    plugins: [
        '@vuepress/back-to-top',
        '@vuepress/active-header-links',
        '@vuepress/medium-zoom',
        '@vuepress/nprogress',
        {
            sidebarLinkSelector: '.sidebar-link',
            headerAnchorSelector: '.header-anchor'
        }
    ],
    base: '/react-docs/'
};