// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublishSwitches, PublishingSection } from './publishing'

const state = vi.hoisted(() => ({
  getPublish: vi.fn(),
  setPublish: vi.fn(),
  forgetCopies: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/api/apps', () => ({
  default: {
    getPublish: (app: string) => state.getPublish(app),
    setPublish: (app: string, accounts: string[]) =>
      state.setPublish(app, accounts),
    forgetCopies: (app: string, account: string) =>
      state.forgetCopies(app, account),
  },
}))
vi.mock('@mochi/web', async (original) => ({
  ...(await original<typeof import('@mochi/web')>()),
  toast: { success: state.success, error: state.error },
}))

const accounts = [
  {
    id: 'b1',
    type: 'bluesky',
    identifier: 'dev.example.org',
    name: 'Dev',
    hosted: true,
  },
  {
    id: 'm1',
    type: 'mastodon',
    identifier: '@dev@mastodon.social',
    name: 'Dev',
    hosted: false,
  },
]

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    </QueryClientProvider>
  )
}

describe('Publisher publishing section', () => {
  beforeEach(() => {
    state.getPublish.mockReset().mockResolvedValue({
      accounts,
      publish: ['m1'],
      copies: { m1: 3 },
      public: true,
    })
    state.setPublish.mockReset()
    state.forgetCopies.mockReset()
    state.success.mockReset()
    state.error.mockReset()
  })

  it('lists the accounts with a switch each, on for those releases go to', async () => {
    wrap(<PublishingSection appId='a1' />)
    expect(await screen.findByText('@dev@mastodon.social')).toBeTruthy()
    expect(state.getPublish).toHaveBeenCalledWith('a1')
    expect(screen.getByText('Mastodon · 3 copies')).toBeTruthy()
    expect(
      screen.getByRole('switch', { name: 'Publish to @dev@mastodon.social' })
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('shows nothing for an app that announces nothing', async () => {
    state.getPublish.mockResolvedValue({
      accounts,
      publish: [],
      copies: {},
      public: false,
    })
    wrap(<PublishingSection appId='a1' />)
    await waitFor(() => expect(state.getPublish).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByText('dev.example.org')).toBeNull()
  })

  it('offers to delete the copies left on an account taken off the list', async () => {
    state.setPublish.mockResolvedValue({ publish: [], kept: { m1: 3 } })
    state.forgetCopies.mockResolvedValue({ deleted: 3 })
    wrap(<PublishingSection appId='a1' />)
    fireEvent.click(
      await screen.findByRole('switch', {
        name: 'Publish to @dev@mastodon.social',
      })
    )
    await waitFor(() => expect(state.setPublish).toHaveBeenCalledWith('a1', []))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete copies' })
    )
    await waitFor(() =>
      expect(state.forgetCopies).toHaveBeenCalledWith('a1', 'm1')
    )
    expect(state.success).toHaveBeenCalledWith('Deleted 3 copies')
  })
})

describe('Publisher publish switches', () => {
  beforeEach(() => {
    state.getPublish.mockReset().mockResolvedValue({
      accounts,
      publish: ['b1'],
      copies: {},
      public: true,
    })
  })

  it("start from the app's list and report a change", async () => {
    const changed = vi.fn()
    wrap(<PublishSwitches appId='a1' chosen={null} onChange={changed} />)
    expect(
      await screen.findByRole('switch', { name: 'dev.example.org' })
    ).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(
      screen.getByRole('switch', { name: '@dev@mastodon.social' })
    )
    expect(changed).toHaveBeenCalledWith(['b1', 'm1'])
  })
})
