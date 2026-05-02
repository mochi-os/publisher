import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { createQueryClient, getRouterBasepath, I18nProvider, type Catalogs } from '@mochi/web'
import { routeTree } from './routeTree.gen'
import './styles/index.css'

// Lingui catalogs bundled by @lingui/vite-plugin (compiled from
// src/locales/<lang>/messages.po on the fly).
const catalogs: Catalogs = {
  en: () => import('./locales/en/messages.po'),
  'en-us': () => import('./locales/en-US/messages.po'),
  fr: () => import('./locales/fr/messages.po'),
  ja: () => import('./locales/ja/messages.po'),

  ar: () => import('./locales/ar/messages.po'),
}

const queryClient = createQueryClient()

const router = createRouter({
  routeTree,
  context: { queryClient },
  basepath: getRouterBasepath(),
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <I18nProvider catalogs={catalogs}>
          <RouterProvider router={router} />

        </I18nProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
