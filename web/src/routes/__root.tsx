import { createRootRoute, Outlet } from '@tanstack/react-router'
import { NavigationProgress, NotificationTitle, Toaster } from '@mochi/common'

export const Route = createRootRoute({
  component: () => (
    <>
      <NotificationTitle />
      <NavigationProgress />
      <Outlet />
      <Toaster duration={5000} />
    </>
  ),
})
