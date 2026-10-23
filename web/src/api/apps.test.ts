// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import appsApi from './apps'

const state = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@mochi/web', async (original) => ({
  ...(await original<typeof import('@mochi/web')>()),
  requestHelpers: {
    post: (url: string, body: unknown) => state.post(url, body),
  },
}))

function sent(): FormData {
  return state.post.mock.calls[0][1] as FormData
}

describe('Uploading a version', () => {
  beforeEach(() => {
    state.post.mockReset().mockResolvedValue({ version: '1.0' })
  })

  it("leaves the release's accounts to the app's list when none are named", async () => {
    await appsApi.uploadVersion('a1', new File(['x'], 'a.zip'), false, false)
    expect(sent().get('accounts')).toBeNull()
  })

  it('sends the accounts chosen for the release', async () => {
    await appsApi.uploadVersion(
      'a1',
      new File(['x'], 'a.zip'),
      false,
      false,
      ['Production'],
      undefined,
      ['m1']
    )
    expect(sent().get('accounts')).toBe('["m1"]')
    expect(sent().get('tracks')).toBe('Production')
  })
})
