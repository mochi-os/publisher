// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// An app id comes from the route, so each builder keeps it in one path segment
// (or one query value): an id holding `../delete`, a query or a slash would
// otherwise aim the request at another action.
import { describe, expect, it } from 'vitest'
import endpoints from './endpoints'

const APP = '1sfEACmTnQhBVgquGhaCs8Jw4SXKF9XY2apnUwJ63duq2QSxh5'
const REFUSED = ['../delete', 'a/b', '.', '..', '']

describe('app endpoints', () => {
  const builders = {
    get: [endpoints.apps.get, `-/view?app=${APP}`],
    share: [endpoints.apps.share, `${APP}/-/share`],
    uploadVersion: [endpoints.apps.uploadVersion, `${APP}/-/version/create`],
    trackDelete: [endpoints.apps.trackDelete, `${APP}/-/track/delete`],
    publishForget: [endpoints.apps.publishForget, `${APP}/-/publish/forget`],
  } as const

  it.each(Object.entries(builders))('%s keeps an app id as is', (_, entry) => {
    const [build, expected] = entry
    expect(build(APP)).toBe(expected)
  })

  it.each(Object.entries(builders))('%s refuses a hostile id', (_, entry) => {
    const [build] = entry
    for (const id of REFUSED) expect(() => build(id)).toThrow()
  })

  it('encodes a query in an id into the one segment', () => {
    expect(endpoints.apps.share('x?y=1')).toBe('x%3Fy%3D1/-/share')
    expect(endpoints.apps.get('x&admin=1')).toBe('-/view?app=x%26admin%3D1')
  })
})
