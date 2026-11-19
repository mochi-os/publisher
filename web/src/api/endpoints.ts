// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { path } from '@mochi/web'

const endpoints = {
  apps: {
    list: '-/list',
    // Management view: class-level, so it reads the CALLER's own database.
    // Right for the publisher, empty for anyone else - which is why the share
    // page cannot use it.
    get: (id: string) => path`-/view?app=${id}`,
    // Share view: entity-scoped, so core resolves the app's OWNER and every
    // visitor reads the publisher's rows. Share data only.
    share: (id: string) => path`${id}/-/share`,
    create: '-/create',
    uploadVersion: (id: string) => path`${id}/-/version/create`,
    trackCreate: (id: string) => path`${id}/-/track/create`,
    trackSet: (id: string) => path`${id}/-/track/set`,
    trackDelete: (id: string) => path`${id}/-/track/delete`,
    defaultTrackSet: (id: string) => path`${id}/-/default-track/set`,
    distributionSet: (id: string) => path`${id}/-/distribution/set`,
    // Where the app's releases are announced on other networks
    publish: (id: string) => path`${id}/-/publish`,
    publishSet: (id: string) => path`${id}/-/publish/set`,
    publishForget: (id: string) => path`${id}/-/publish/forget`,
  },
} as const

export default endpoints
