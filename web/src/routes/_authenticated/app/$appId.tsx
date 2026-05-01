import { useState, useRef } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Button,
  cn,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PageHeader,
  Input,
  Main,
  usePageTitle,
  getErrorMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
  Section,
  FieldRow,
  DataChip,
  EmptyState,
  GeneralError,
  ListSkeleton,
  ApiError,
} from '@mochi/web'
import { Upload, Plus, MoreHorizontal, Package, Shield, Globe, Lock } from 'lucide-react'
import { sortVersionsDesc } from '@/lib/version'
import {
  useAppQuery,
  useUploadVersionMutation,
  useCreateTrackMutation,
  useSetTrackMutation,
  useDeleteTrackMutation,
  useSetDefaultTrackMutation,
  useSetDistributionMutation,
} from '@/hooks/useApps'

type TabId = 'details' | 'versions' | 'tracks'

type AppSearch = {
  tab?: TabId
}

export const Route = createFileRoute('/_authenticated/app/$appId')({
  validateSearch: (search: Record<string, unknown>): AppSearch => ({
    tab: (search.tab === 'details' || search.tab === 'versions' || search.tab === 'tracks') ? search.tab : undefined,
  }),
  component: AppPage,
})

function AppPage() {
  const { t } = useLingui()
  const { appId } = Route.useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useAppQuery(appId)
  const setDistributionMutation = useSetDistributionMutation()
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showAddTrack, setShowAddTrack] = useState(false)

  const handleSetDistribution = (distribution: string) => {
    setDistributionMutation.mutate(
      { appId, distribution },
      {
        onSuccess: () => {
          toast.success(`Distribution set to ${distribution}`)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t`Failed to update distribution`))
        },
      }
    )
  }
  const navigateApp = Route.useNavigate()
  const { tab } = Route.useSearch()
  const activeTab = tab ?? 'details'

  const setActiveTab = (newTab: TabId) => {
    void navigateApp({ search: { tab: newTab }, replace: true })
  }
  const goBackToApps = () => navigate({ to: '/' })

  usePageTitle(data?.app?.name ?? 'App')

  if (isLoading) {
    return (
      <>
        <PageHeader
          title={t`Loading app...`}
          back={{ label: t`Back to apps`, onFallback: goBackToApps }}
        />
        <Main className='pt-2'>
          <ListSkeleton variant='card' count={3} />
        </Main>
      </>
    )
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <>
          <PageHeader title={t`App not found`} back={{ label: t`Back to apps`, onFallback: goBackToApps }} />
          <Main>
            <EmptyState
              icon={Package}
              title={t`App not found`}
              description={t`The requested app could not be found.`}
            />
          </Main>
        </>
      )
    }

    return (
      <>
        <PageHeader title={t`App`} back={{ label: t`Back to apps`, onFallback: goBackToApps }} />
        <Main>
          <GeneralError error={error} minimal mode='inline' reset={refetch} />
        </Main>
      </>
    )
  }

  if (!data || !data.app) {
    return (
      <>
        <PageHeader title={t`App not found`} back={{ label: t`Back to apps`, onFallback: goBackToApps }} />
        <Main>
          <EmptyState
            icon={Package}
            title={t`App not found`}
            description={t`The requested app could not be found.`}
          />
        </Main>
      </>
    )
  }

  const { app, tracks, versions, administrator, share, publisher } = data

  // Build share string: just app ID for public, app@publisher for private
  const shareString = app.privacy === 'public' ? app.id : `${app.id}@${publisher}`

  // Show share page for unauthenticated users or non-admins
  if (share) {
    return <SharePage app={app} tracks={tracks} shareString={shareString} onBack={goBackToApps} />
  }

  // Show management page for administrators
  return (
    <>
      <PageHeader title={app.name} back={{ label: t`Back to apps`, onFallback: goBackToApps }} />
      <Main className='pt-2 space-y-6'>
        <div className='flex items-center justify-between border-b'>
          <div className='flex gap-1'>
            {(['details', 'versions', 'tracks'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  'border-b-2 -mb-px capitalize',
                  activeTab === tab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          {activeTab === 'versions' && (
            <Button onClick={() => setShowUploadDialog(true)} className='mb-2' size="sm">
              <Upload className='mr-2 h-4 w-4' />
              <Trans>Upload new version</Trans>
            </Button>
          )}
          {activeTab === 'tracks' && (
            <Button variant='outline' size='sm' onClick={() => setShowAddTrack(true)} className='mb-2'>
              <Plus className='h-4 w-4 mr-2' />
              <Trans>Create track</Trans>
            </Button>
          )}
        </div>

        <div className="pt-2">
          {activeTab === 'details' && (
            <div className='space-y-6'>
              <Section title={t`Identity`} description={t`Core identification for this application`}>
                <div className="divide-y-0">
                  <FieldRow label={t`Application ID`}>
                    <DataChip value={app.id} />
                  </FieldRow>
                  <FieldRow label={t`Fingerprint`}>
                    <DataChip value={app.fingerprint || ''} truncate='middle' />
                  </FieldRow>
                  <FieldRow label={t`Privacy Policy`}>
                    <div className="flex items-center gap-2">
                      {app.privacy === 'public' ? (
                        <DataChip value="Public" icon={<Globe className="size-3.5" />} copyable={false} />
                      ) : (
                        <DataChip value="Private" icon={<Lock className="size-3.5" />} copyable={false} />
                      )}
                    </div>
                  </FieldRow>
                  <FieldRow label={t`Distribution`}>
                    <Select
                      value={app.distribution ?? 'published'}
                      onValueChange={handleSetDistribution}
                      disabled={setDistributionMutation.isPending}
                    >
                      <SelectTrigger className='w-36 h-8 text-xs'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='published'><Trans>Published</Trans></SelectItem>
                        <SelectItem value='restricted'><Trans>Restricted</Trans></SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </div>
              </Section>

              <Section 
                title={t`Sharing`} 
                description={t`Share this ID to allow others to install this app`}
              >
                <div className="space-y-4">
                  <p className='text-muted-foreground text-sm'>
                    <Trans>Users can install this application by pasting this identifier into their Apps management page.</Trans>
                  </p>
                  <FieldRow label={t`Installation ID`}>
                    <DataChip value={shareString} />
                  </FieldRow>
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'versions' && (
            <Section title={t`Version History`} description={t`All uploaded build files for this application`}>
              {versions.length === 0 ? (
                <div className="py-8">
                  <EmptyState
                    icon={Package}
                    title={t`No versions`}
                    description={t`Upload your first build to get started`}
                  />
                </div>
              ) : (
                <div className='divide-y border rounded-lg overflow-hidden'>
                  {sortVersionsDesc(versions).map((version) => (
                    <div key={version.version} className='flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-2'>
                      <div className="flex items-center gap-3">
                        <Package className="size-4 text-muted-foreground" />
                        <span className='font-mono text-sm font-semibold'>
                          {version.version}
                        </span>
                      </div>
                      <span className='text-muted-foreground bg-surface-2 text-xs font-mono rounded px-2 py-0.5'>
                        {version.file}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {activeTab === 'tracks' && (
            <TracksTab
              appId={appId}
              tracks={tracks}
              versions={versions}
              defaultTrack={app.default_track ?? 'Production'}
              showAddTrack={showAddTrack}
              setShowAddTrack={setShowAddTrack}
            />
          )}
        </div>

        <UploadVersionDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          appId={appId}
          showInstallOption={administrator}
          availableTracks={tracks.map((t) => t.track)}
        />
      </Main>
    </>
  )
}

function SharePage({
  app,
  tracks,
  shareString,
  onBack,
}: {
  app: { id: string; name: string; privacy: string; fingerprint?: string }
  tracks: { track: string; version: string }[]
  shareString: string
  onBack: () => void | Promise<void>
}) {
  const { t } = useLingui()
  return (
    <>
      <PageHeader title={app.name} back={{ label: t`Back to apps`, onFallback: onBack }} />
      <Main className='pt-2'>
        <div className='space-y-6'>
          <Section title={t`Install App`} description={t`Install this application to your server`}>
            <div className="space-y-4">
              <p className='text-muted-foreground text-sm'>
                <Trans>Copy this ID and paste it in your Mochi server's Apps page to install.</Trans>
              </p>
              <FieldRow label={t`App ID`}>
                <DataChip value={shareString} />
              </FieldRow>
            </div>
          </Section>

          <Section title={t`Details`} description={t`Metadata and configuration`}>
            <div className="divide-y-0">
              <FieldRow label={t`Fingerprint`}>
                <DataChip value={app.fingerprint || 'N/A'} truncate='middle' />
              </FieldRow>
              <FieldRow label={t`Privacy`}>
                <DataChip 
                  value={app.privacy} 
                  icon={app.privacy === 'public' ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />} 
                  copyable={false} 
                />
              </FieldRow>
            </div>
          </Section>

          {tracks.length > 0 && (
            <Section title={t`Available Versions`} description={"Release tracks currently active"}>
              <div className='divide-y border rounded-lg overflow-hidden'>
                {tracks.map((track) => (
                  <div key={track.track} className='flex items-center justify-between py-3 px-4'>
                    <span className='font-medium text-sm'>{track.track}</span>
                    <DataChip value={track.version} copyable={false} />
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </Main>
    </>
  )
}

function TracksTab({
  appId,
  tracks,
  versions,
  defaultTrack,
  showAddTrack,
  setShowAddTrack,
}: {
  appId: string
  tracks: { track: string; version: string }[]
  versions: { version: string }[]
  defaultTrack: string
  showAddTrack: boolean
  setShowAddTrack: (open: boolean) => void
}) {
  const { t } = useLingui()
  const [newTrackName, setNewTrackName] = useState('')
  const [newTrackVersion, setNewTrackVersion] = useState('__none__')

  const createTrackMutation = useCreateTrackMutation()
  const setTrackMutation = useSetTrackMutation()
  const deleteTrackMutation = useDeleteTrackMutation()
  const setDefaultTrackMutation = useSetDefaultTrackMutation()

  const handleCreateTrack = () => {
    if (!newTrackName) return
    const version = newTrackVersion === '__none__' ? '' : newTrackVersion
    createTrackMutation.mutate(
      { appId, track: newTrackName, version },
      {
        onSuccess: () => {
          toast.success(t`Track created`)
          setNewTrackName('')
          setNewTrackVersion('__none__')
          setShowAddTrack(false)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t`Failed to create track`))
        },
      }
    )
  }

  const handleSetTrackVersion = (track: string, version: string) => {
    setTrackMutation.mutate(
      { appId, track, version },
      {
        onSuccess: () => {
          toast.success(`Track "${track}" updated to ${version}`)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t`Failed to update track`))
        },
      }
    )
  }

  const handleDeleteTrack = (track: string) => {
    deleteTrackMutation.mutate(
      { appId, track },
      {
        onSuccess: () => {
          toast.success(`Track "${track}" deleted`)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t`Failed to delete track`))
        },
      }
    )
  }

  const handleSetDefaultTrack = (track: string) => {
    setDefaultTrackMutation.mutate(
      { appId, track },
      {
        onSuccess: () => {
          toast.success(`Default track set to "${track}"`)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t`Failed to set default track`))
        },
      }
    )
  }

  return (
    <Section 
      title={t`Release Tracks`} 
      description={"Manage deployment environments and their versions"}
    >
      {tracks.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon={Shield}
            title={t`No tracks`}
            description={"Create your first release track to manage deployments"}
          />
        </div>
      ) : (
        <div className='divide-y border rounded-lg overflow-hidden'>
          {tracks.map((track) => (
            <div
              key={track.track}
              className='flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-2'
            >
              <div className="flex flex-col">
                <span className='font-semibold text-sm flex items-center gap-2'>
                  {track.track}
                  {track.track === defaultTrack && (
                    <span className='text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-full'>default</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground"><Trans>Active version</Trans></span>
              </div>
              
              <div className='flex items-center gap-3'>
                <Select
                  value={track.version}
                  onValueChange={(v) => handleSetTrackVersion(track.track, v)}
                >
                  <SelectTrigger className='w-32 h-8 text-xs font-mono'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortVersionsDesc(versions).map((v) => (
                      <SelectItem key={v.version} value={v.version} className="font-mono text-xs">
                        {v.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon' className="h-8 w-8" aria-label={t`Open track actions`}>
                      <MoreHorizontal className='h-4 w-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem
                      onClick={() => handleSetDefaultTrack(track.track)}
                      disabled={track.track === defaultTrack}
                      className="text-xs"
                    >
                      <Trans>Set as default</Trans>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteTrack(track.track)}
                      disabled={track.track === defaultTrack}
                      className="text-xs text-destructive"
                    >
                      <Trans>Delete track</Trans>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <ResponsiveDialog open={showAddTrack} onOpenChange={(open) => {
        setShowAddTrack(open)
        if (!open) {
          setNewTrackName('')
          setNewTrackVersion('')
        }
      }}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle><Trans>New Release Track</Trans></ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              <Trans>Create a new environment (e.g. Beta, Staging) to deploy builds.</Trans>
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <label htmlFor='trackName' className='text-sm font-medium'>
                <Trans>Track Name</Trans>
              </label>
              <Input
                id='trackName'
                placeholder="e.g. Staging"
                value={newTrackName}
                onChange={(e) => setNewTrackName(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'><Trans>Initial Version</Trans></label>
              <Select value={newTrackVersion} onValueChange={setNewTrackVersion}>
                <SelectTrigger>
                  <SelectValue placeholder={t`No version`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__' className='text-muted-foreground'><Trans>Leave empty</Trans></SelectItem>
                  {sortVersionsDesc(versions).map((v) => (
                    <SelectItem key={v.version} value={v.version} className="font-mono">
                      {v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowAddTrack(false)}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              onClick={handleCreateTrack}
              disabled={!newTrackName || createTrackMutation.isPending}
            >
              {createTrackMutation.isPending ? "Creating..." : "Create Track"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </Section>
  )
}

function UploadVersionDialog({
  open,
  onOpenChange,
  appId,
  showInstallOption,
  availableTracks,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  showInstallOption: boolean
  availableTracks: string[]
}) {
  const { t } = useLingui()
  const [file, setFile] = useState<File | null>(null)
  const [installOption, setInstallOption] = useState<'yes' | 'yes-force' | 'no'>('yes')
  const [selectedTracks, setSelectedTracks] = useState<string[]>(['Production'])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadMutation = useUploadVersionMutation()

  const toggleTrack = (track: string) => {
    setSelectedTracks((prev) =>
      prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error(t`Please select a file`)
      return
    }

    const install = installOption !== 'no'
    const force = installOption === 'yes-force'

    uploadMutation.mutate(
      { appId, file, install, force, tracks: selectedTracks },
      {
        onSuccess: (data: { version: string }) => {
          toast.success(t`Version uploaded`, {
            description: `Version ${data.version} has been created.`,
          })
          setFile(null)
          setInstallOption('yes')
          setSelectedTracks(['Production'])
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          onOpenChange(false)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t`Failed to upload version`))
        },
      }
    )
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle><Trans>Upload New Version</Trans></ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            <Trans>Upload a .zip build file for your application.</Trans>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <label htmlFor='file' className='text-sm font-medium'>
                Build File (.zip)
              </label>
              <Input
                ref={fileInputRef}
                id='file'
                type='file'
                accept='.zip'
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            {showInstallOption && (
              <div className='space-y-2'>
                <label htmlFor='install' className='text-sm font-medium'>
                  <Trans>Install Locally</Trans>
                </label>
                <select
                  id='install'
                  value={installOption}
                  onChange={(e) => setInstallOption(e.target.value as 'yes' | 'yes-force' | 'no')}
                  className='border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm'
                >
                  <option value='yes'><Trans>Yes</Trans></option>
                  <option value='yes-force'><Trans>Yes, force</Trans></option>
                  <option value='no'>No</option>
                </select>
              </div>
            )}
            {availableTracks.length > 0 && (
              <div className='space-y-2'>
                <label className='text-sm font-medium'><Trans>Update Tracks</Trans></label>
                <div className='grid grid-cols-2 gap-2'>
                  {availableTracks.map((track) => (
                    <label key={track} className='flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors hover:bg-interactive-hover active:bg-interactive-active'>
                      <input
                        type='checkbox'
                        checked={selectedTracks.includes(track)}
                        onChange={() => toggleTrack(track)}
                        className='h-4 w-4 rounded border-gray-300 accent-primary'
                      />
                      <span className='text-sm'>{track}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <ResponsiveDialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button type='submit' disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? "Uploading..." : "Upload Version"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
