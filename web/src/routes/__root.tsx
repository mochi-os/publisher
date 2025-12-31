import { createRootRoute, Outlet } from '@tanstack/react-router'
import { NavigationProgress, Toaster } from '@mochi/common'

export const Route = createRootRoute({
  component: () => (
    <>
      <NavigationProgress />
      <Outlet />
      <Toaster duration={5000} />
    </>
  ),
})
