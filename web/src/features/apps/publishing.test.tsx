// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// The accounts one release also goes to: one line naming those chosen,
// preset from the app's list, which opens into a switch per account; none
// for an app that is not public.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublishSwitches, PublishingSection } from './publishing'

const state = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))

vi.mock('@/api/apps', () => ({
  default: {
    getPublish: (appId: string) => state.get(appId),
    setPublish: (appId: string, next: string[]) => state.set(appId, next),
  },
}))

const accounts = [
  {
    id: 'm1',
    type: 'mastodon',
    identifier: '@alice@mastodon.social',
    name: 'Alice',
    hosted: false,
  },
  {
    id: 'b1',
    type: 'bluesky',
    identifier: 'alice.example.org',
    name: 'Alice',
    hosted: true,
  },
]

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    </QueryClientProvider>
  )
  return client
}

describe('Release publish switches', () => {
  beforeEach(() => {
    i18n.load('en', {})
    i18n.activate('en')
    state.get.mockReset().mockResolvedValue({
      accounts,
      publish: ['m1'],
      copies: {},
      public: true,
    })
  })

  it("start from the app's list and report a change", async () => {
    const changed = vi.fn()
    wrap(<PublishSwitches appId='a1' chosen={null} onChange={changed} />)
    const line = await screen.findByRole('button', { name: /Also post to/ })
    expect(line).toHaveTextContent('@alice@mastodon.social')
    expect(line).not.toHaveTextContent('alice.example.org')
    expect(screen.queryByRole('switch')).toBeNull()
    fireEvent.click(line)
    fireEvent.click(screen.getByRole('switch', { name: 'alice.example.org' }))
    expect(changed).toHaveBeenCalledWith(['m1', 'b1'])
  })

  it('offers nothing for an app that is not public', async () => {
    state.get.mockResolvedValue({
      accounts,
      publish: ['m1'],
      copies: {},
      public: false,
    })
    const client = wrap(
      <PublishSwitches appId='a1' chosen={null} onChange={vi.fn()} />
    )
    await waitFor(() =>
      expect(client.getQueryState(['apps', 'publish', 'a1'])?.status).toBe(
        'success'
      )
    )
    expect(screen.queryByText('Also post to')).toBeNull()
  })
})

describe('Release publishing section', () => {
  beforeEach(() => {
    i18n.load('en', {})
    i18n.activate('en')
    state.get.mockReset().mockResolvedValue({
      accounts,
      publish: ['m1'],
      copies: {},
      public: true,
    })
    state.set.mockReset()
  })

  // A switch moves when clicked, not once the server has answered and the
  // list has been read again, and goes back when the change is refused.
  it('moves a switch at once, and back when the change is refused', async () => {
    let refuse: (error: Error) => void = () => {}
    state.set.mockImplementation(
      () => new Promise((_, reject) => (refuse = reject))
    )
    wrap(<PublishingSection appId='a1' />)
    const toggle = await screen.findByRole('switch', {
      name: 'Publish to alice.example.org',
    })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await act(async () => refuse(new Error('refused')))
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  })
})
