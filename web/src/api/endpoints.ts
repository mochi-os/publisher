// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

const endpoints = {
  apps: {
    list: '-/list',
    get: (id: string) => `-/view?app=${id}`,
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
