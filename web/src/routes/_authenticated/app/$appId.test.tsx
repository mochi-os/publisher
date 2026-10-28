// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it } from 'vitest'
import { appTabs } from './$appId'

describe('appTabs', () => {
  it('puts Publish to last where the app has somewhere to announce', () => {
    expect(appTabs(undefined, true)).toEqual({
      tabs: ['details', 'versions', 'tracks', 'publish'],
      active: 'details',
    })
    expect(appTabs('publish', true).active).toBe('publish')
  })

  it('leaves Publish to out where there is nowhere to announce, and opens the details for a link to it', () => {
    expect(appTabs('publish', false)).toEqual({
      tabs: ['details', 'versions', 'tracks'],
      active: 'details',
    })
    expect(appTabs('tracks', false).active).toBe('tracks')
  })

  it('holds a link to Publish to while that is asked', () => {
    expect(appTabs('publish', undefined)).toEqual({
      tabs: ['details', 'versions', 'tracks', 'publish'],
      active: 'publish',
    })
    expect(appTabs(undefined, undefined).tabs).toEqual([
      'details',
      'versions',
      'tracks',
    ])
  })
})
