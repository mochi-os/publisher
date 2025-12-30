export interface App {
  id: string
  name: string
  privacy: string
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
