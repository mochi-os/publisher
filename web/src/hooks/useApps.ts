import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useQueryWithError } from '@mochi/common'
import { appsApi, type App } from '@/api/apps'

export const appKeys = {
  all: () => ['apps'] as const,
  list: () => ['apps', 'list'] as const,
  detail: (id: string) => ['apps', 'detail', id] as const,
}

export const useAppsQuery = () =>
  useQueryWithError<App[], Error>({
    queryKey: appKeys.list(),
    queryFn: () => appsApi.list(),
  })

export const useAppQuery = (id: string) =>
  useQuery({
    queryKey: appKeys.detail(id),
    queryFn: () => appsApi.get(id),
    enabled: !!id,
  })

export const useCreateAppMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, privacy }: { name: string; privacy: string }) =>
      appsApi.create(name, privacy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.all() })
    },
  })
}

export const useUploadVersionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      appId,
      file,
      install,
      force,
      tracks,
    }: {
      appId: string
      file: File
      install: boolean
      force: boolean
      tracks?: string[]
    }) => appsApi.uploadVersion(appId, file, install, force, tracks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.all() })
    },
  })
}

export const useCreateTrackMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      appId,
      track,
      version,
    }: {
      appId: string
      track: string
      version: string
    }) => appsApi.createTrack(appId, track, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: appKeys.all() })
    },
  })
}

export const useSetTrackMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      appId,
      track,
      version,
    }: {
      appId: string
      track: string
      version: string
    }) => appsApi.setTrack(appId, track, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.all() })
    },
  })
}

export const useDeleteTrackMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ appId, track }: { appId: string; track: string }) =>
      appsApi.deleteTrack(appId, track),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.all() })
    },
  })
}

export const useSetDefaultTrackMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ appId, track }: { appId: string; track: string }) =>
      appsApi.setDefaultTrack(appId, track),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.all() })
    },
  })
}
