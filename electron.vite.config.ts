import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [
      vue(),
      ui({
        router: false,
        colorMode: false,
        dts: false,
        // Icons are bundled at build time: the app never fetches anything from the internet.
        icon: {
          clientBundle: {
            scan: true,
            // Names built at runtime (templates in src/shared) are listed explicitly.
            icons: [
              'lucide:key-round', 'lucide:credit-card', 'lucide:wifi', 'lucide:id-card', 'lucide:landmark', 'lucide:server',
              'lucide:sticky-note', 'lucide:bell', 'lucide:circle', 'lucide:user', 'lucide:user-plus', 'lucide:check',
              'lucide:circle-alert', 'lucide:pin', 'lucide:pin-off', 'lucide:eye', 'lucide:eye-off', 'lucide:image',
              'lucide:file-text', 'lucide:file', 'lucide:list-checks', 'lucide:pencil', 'lucide:panel-left', 'lucide:panel-right',
              'lucide:picture-in-picture-2', 'lucide:chevron-left', 'lucide:x', 'lucide:lock', 'lucide:lock-open',
              // category icons (src/shared/model.ts) and menus
              'lucide:folder', 'lucide:briefcase', 'lucide:house', 'lucide:shopping-bag', 'lucide:gamepad-2', 'lucide:graduation-cap',
              'lucide:heart-pulse', 'lucide:plane', 'lucide:code', 'lucide:mail', 'lucide:users', 'lucide:tv', 'lucide:car',
              'lucide:building-2', 'lucide:star', 'lucide:folder-input', 'lucide:folder-plus', 'lucide:ellipsis',
              'lucide:arrow-up', 'lucide:arrow-down', 'lucide:chevron-up', 'lucide:pencil', 'lucide:trash-2',
              // TO DO tab, timer and alerts
              'lucide:list-todo', 'lucide:timer', 'lucide:play', 'lucide:pause', 'lucide:rotate-ccw', 'lucide:volume-2'
            ]
          }
        },
        ui: {
          colors: { primary: 'green', neutral: 'neutral' }
        }
      })
    ]
  }
})
