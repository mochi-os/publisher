import { createRootRoute, Outlet } from '@tanstack/react-router'
import { NotificationTitle, Toaster } from '@mochi/web'

export const Route = createRootRoute({
  component: () => (
    <>
      <NotificationTitle />
      <Outlet />
      <Toaster duration={5000} />
    </>
  ),
})
