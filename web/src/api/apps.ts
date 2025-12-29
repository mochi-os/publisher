import { requestHelpers } from '@mochi/common'
import endpoints from '@/api/endpoints'
import type {
  AppsListResponse,
  AppDetailsResponse,
  CreateAppResponse,
  UploadVersionResponse,
  App,
  Track,
  Version,
} from '@/api/types/apps'

const listApps = async (): Promise<App[]> => {
  const response = await requestHelpers.get<AppsListResponse>(
    endpoints.apps.list
  )
  return response.apps
}

const getApp = async (id: string): Promise<{
  app: App
  tracks: Track[]
  versions: Version[]
  administrator: boolean
  share: boolean
  publisher: string
}> => {
  const response = await requestHelpers.get<AppDetailsResponse>(
    endpoints.apps.get(id)
  )
  return response
}

const createApp = async (
  name: string,
  privacy: string
): Promise<{ id: string; name: string }> => {
  const response = await requestHelpers.post<CreateAppResponse>(
    endpoints.apps.create,
    { name, privacy }
  )
  return response
}

const uploadVersion = async (
  appId: string,
  file: File,
  install: boolean,
  force: boolean
): Promise<{ version: string; app: App }> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('install', install ? 'yes' : 'no')
  if (force) {
    formData.append('force', 'yes')
  }

  const response = await requestHelpers.post<UploadVersionResponse>(
    endpoints.apps.uploadVersion(appId),
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return response
}

const createTrack = async (
  appId: string,
  track: string,
  version: string
): Promise<{ track: string; version: string }> => {
  const response = await requestHelpers.post<{ track: string; version: string }>(
    endpoints.apps.trackCreate(appId),
    { app: appId, track, version }
  )
  return response
}

const setTrack = async (
  appId: string,
  track: string,
  version: string
): Promise<{ track: string; version: string }> => {
  const response = await requestHelpers.post<{ track: string; version: string }>(
    endpoints.apps.trackSet(appId),
    { app: appId, track, version }
  )
  return response
}

const deleteTrack = async (
  appId: string,
  track: string
): Promise<{ deleted: string }> => {
  const response = await requestHelpers.post<{ deleted: string }>(
    endpoints.apps.trackDelete(appId),
    { app: appId, track }
  )
  return response
}

const setDefaultTrack = async (
  appId: string,
  track: string
): Promise<{ default_track: string }> => {
  const response = await requestHelpers.post<{ default_track: string }>(
    endpoints.apps.defaultTrackSet(appId),
    { app: appId, track }
  )
  return response
}

const appsApi = {
  list: listApps,
  get: getApp,
  create: createApp,
  uploadVersion,
  createTrack,
  setTrack,
  deleteTrack,
  setDefaultTrack,
}

export default appsApi
