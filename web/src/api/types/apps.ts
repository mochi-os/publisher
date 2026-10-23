// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

export interface App {
  id: string
  name: string
  privacy: string
  distribution?: string
  version?: string
  fingerprint?: string
  default_track?: string
}

export interface Track {
  app: string
  track: string
  version: string
}

export interface Version {
  app: string
  version: string
  file: string
}

export interface AppsListResponse {
  apps: App[]
}

export interface AppDetailsResponse {
  app: App
  tracks: Track[]
  versions: Version[]
  administrator: boolean
  share: boolean
  publisher: string
}

export interface CreateAppResponse {
  id: string
  name: string
}

export interface UploadVersionResponse {
  version: string
  app: App
  tracks: string[]
}

/** One of the user's accounts on another network an app's releases may be announced to. */
export interface PublishAccount {
  id: string
  /** `mastodon`, `bluesky` or `fediverse`. */
  type: string
  /** The account's address on its network. */
  identifier: string
  name: string
  hosted: boolean
}

/** `publish`: the accounts, those the app announces to, its copies on each, and whether it announces at all. */
export interface PublishResponse {
  accounts: PublishAccount[]
  publish: string[]
  copies: Record<string, number>
  public: boolean
}

/** `publish/set`: the new list, and the copies left on each account that left it. */
export interface PublishSetResponse {
  publish: string[]
  kept: Record<string, number>
}
