// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

const endpoints = {
  apps: {
    list: '-/list',
    // Management view: class-level, so it reads the CALLER's own database.
    // Right for the publisher, empty for anyone else - which is why the share
    // page cannot use it.
    get: (id: string) => `-/view?app=${id}`,
    // Share view: entity-scoped, so core resolves the app's OWNER and every
    // visitor reads the publisher's rows. Share data only.
    share: (id: string) => `${id}/-/share`,
    create: '-/create',
    uploadVersion: (id: string) => `${id}/-/version/create`,
    trackCreate: (id: string) => `${id}/-/track/create`,
    trackSet: (id: string) => `${id}/-/track/set`,
    trackDelete: (id: string) => `${id}/-/track/delete`,
    defaultTrackSet: (id: string) => `${id}/-/default-track/set`,
    distributionSet: (id: string) => `${id}/-/distribution/set`,
  },
} as const

export default endpoints
