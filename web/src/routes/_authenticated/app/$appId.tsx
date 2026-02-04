import { useState, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Header,
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
  Skeleton,
  Section,
  FieldRow,
  DataChip,
  EmptyState,
} from '@mochi/common'
import { Upload, Plus, MoreHorizontal, Package, Shield, Globe, Lock } from 'lucide-react'
import { sortVersionsDesc } from '@/lib/version'
import {
  useAppQuery,
  useUploadVersionMutation,
  useCreateTrackMutation,
  useSetTrackMutation,
  useDeleteTrackMutation,
  useSetDefaultTrackMutation,
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
  const { appId } = Route.useParams()
  const { data, isLoading, isError } = useAppQuery(appId)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showAddTrack, setShowAddTrack] = useState(false)
  const navigateApp = Route.useNavigate()
  const { tab } = Route.useSearch()
  const activeTab = tab ?? 'details'

  const setActiveTab = (newTab: TabId) => {
    void navigateApp({ search: { tab: newTab }, replace: true })
  }

  usePageTitle(data?.app?.name ?? 'App')

  if (isLoading) {
    return (
      <Main className='pt-2 space-y-6'>
        <div className='flex items-center justify-between border-b pb-2'>
          <Skeleton className='h-8 w-48' />
        </div>
        <Skeleton className='h-64 w-full rounded-xl' />
      </Main>
    )
  }

  if (isError || !data || !data.app) {
    return (
      <Main>
        <EmptyState
          icon={Package}
          title="App not found"
          description="The requested app could not be found."
        />
      </Main>
    )
  }

  const { app, tracks, versions, administrator, share, publisher } = data

  // Build share string: just app ID for public, app@publisher for private
  const shareString = app.privacy === 'public' ? app.id : `${app.id}@${publisher}`

  // Show share page for unauthenticated users or non-admins
  if (share) {
    return <SharePage app={app} tracks={tracks} shareString={shareString} />
  }

  // Show management page for administrators
  return (
    <>
      <Header>
        <h1 className='text-lg font-semibold'>{app.name}</h1>
      </Header>
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
              Upload new version
            </Button>
          )}
          {activeTab === 'tracks' && (
            <Button variant='outline' size='sm' onClick={() => setShowAddTrack(true)} className='mb-2'>
              <Plus className='h-4 w-4 mr-2' />
              Create track
            </Button>
          )}
        </div>

        <div className="pt-2">
          {activeTab === 'details' && (
            <div className='space-y-6'>
              <Section title="Identity" description="Core identification for this application">
                <div className="divide-y-0">
                  <FieldRow label="Application ID">
                    <DataChip value={app.id} />
                  </FieldRow>
                  <FieldRow label="Fingerprint">
                    <DataChip value={app.fingerprint || ''} />
                  </FieldRow>
                  <FieldRow label="Privacy Policy">
                    <div className="flex items-center gap-2">
                      {app.privacy === 'public' ? (
                        <DataChip value="Public" icon={<Globe className="size-3.5" />} copyable={false} />
                      ) : (
                        <DataChip value="Private" icon={<Lock className="size-3.5" />} copyable={false} />
                      )}
                    </div>
                  </FieldRow>
                </div>
              </Section>

              <Section 
                title="Sharing" 
                description="Share this ID to allow others to install this app"
              >
                <div className="space-y-4">
                  <p className='text-muted-foreground text-sm'>
                    Users can install this application by pasting this identifier into their Apps management page.
                  </p>
                  <div className="max-w-md">
                    <FieldRow label="Installation ID">
                      <DataChip value={shareString} chipClassName="bg-primary/5 border-primary/20 text-primary" />
                    </FieldRow>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'versions' && (
            <Section title="Version History" description="All uploaded build files for this application">
              {versions.length === 0 ? (
                <div className="py-8">
                  <EmptyState
                    icon={Package}
                    title="No versions"
                    description="Upload your first build to get started"
                  />
                </div>
              ) : (
                <div className='divide-y border rounded-lg overflow-hidden'>
                  {sortVersionsDesc(versions).map((version) => (
                    <div key={version.version} className='flex items-center justify-between py-3 px-4 hover:bg-muted/30 transition-colors'>
                      <div className="flex items-center gap-3">
                        <Package className="size-4 text-muted-foreground" />
                        <span className='font-mono text-sm font-semibold'>
                          {version.version}
                        </span>
                      </div>
                      <span className='text-muted-foreground text-xs font-mono bg-muted px-2 py-0.5 rounded'>
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
}: {
  app: { id: string; name: string; privacy: string; fingerprint?: string }
  tracks: { track: string; version: string }[]
  shareString: string
}) {
  return (
    <>
      <Header>
        <h1 className='text-lg font-semibold'>{app.name}</h1>
      </Header>
      <Main className='pt-2'>
        <div className='space-y-6'>
          <Section title="Install App" description="Install this application to your server">
            <div className="space-y-4">
              <p className='text-muted-foreground text-sm'>
                Copy this ID and paste it in your Mochi server's Apps page to install.
              </p>
              <FieldRow label="App ID">
                <DataChip value={shareString} chipClassName="bg-primary/5 border-primary/20 text-primary" />
              </FieldRow>
            </div>
          </Section>

          <Section title="Details" description="Metadata and configuration">
            <div className="divide-y-0">
              <FieldRow label="Fingerprint">
                <DataChip value={app.fingerprint || 'N/A'} />
              </FieldRow>
              <FieldRow label="Privacy">
                <DataChip 
                  value={app.privacy} 
                  icon={app.privacy === 'public' ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />} 
                  copyable={false} 
                />
              </FieldRow>
            </div>
          </Section>

          {tracks.length > 0 && (
            <Section title="Available Versions" description="Release tracks currently active">
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
          toast.success('Track created')
          setNewTrackName('')
          setNewTrackVersion('__none__')
          setShowAddTrack(false)
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
      }
    )
  }

  return (
    <Section 
      title="Release Tracks" 
      description="Manage deployment environments and their versions"
    >
      {tracks.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon={Shield}
            title="No tracks"
            description="Create your first release track to manage deployments"
          />
        </div>
      ) : (
        <div className='divide-y border rounded-lg overflow-hidden'>
          {tracks.map((track) => (
            <div
              key={track.track}
              className='flex items-center justify-between py-3 px-4 hover:bg-muted/10 transition-colors'
            >
              <div className="flex flex-col">
                <span className='font-semibold text-sm flex items-center gap-2'>
                  {track.track}
                  {track.track === defaultTrack && (
                    <span className='text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-full'>default</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">Active version</span>
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
                    <Button variant='ghost' size='icon' className="h-8 w-8">
                      <MoreHorizontal className='h-4 w-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem
                      onClick={() => handleSetDefaultTrack(track.track)}
                      disabled={track.track === defaultTrack}
                      className="text-xs"
                    >
                      Set as default
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteTrack(track.track)}
                      disabled={track.track === defaultTrack}
                      className="text-xs text-destructive"
                    >
                      Delete track
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAddTrack} onOpenChange={(open) => {
        setShowAddTrack(open)
        if (!open) {
          setNewTrackName('')
          setNewTrackVersion('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Release Track</DialogTitle>
            <DialogDescription>
              Create a new environment (e.g. Beta, Staging) to deploy builds.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <label htmlFor='trackName' className='text-sm font-medium'>
                Track Name
              </label>
              <Input
                id='trackName'
                placeholder="e.g. Staging"
                value={newTrackName}
                onChange={(e) => setNewTrackName(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Initial Version</label>
              <Select value={newTrackVersion} onValueChange={setNewTrackVersion}>
                <SelectTrigger>
                  <SelectValue placeholder='No version' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__ text-muted-foreground'>Leave empty</SelectItem>
                  {sortVersionsDesc(versions).map((v) => (
                    <SelectItem key={v.version} value={v.version} className="font-mono">
                      {v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowAddTrack(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTrack}
              disabled={!newTrackName || createTrackMutation.isPending}
            >
              {createTrackMutation.isPending ? 'Creating...' : 'Create Track'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      toast.error('Please select a file')
      return
    }

    const install = installOption !== 'no'
    const force = installOption === 'yes-force'

    uploadMutation.mutate(
      { appId, file, install, force, tracks: selectedTracks },
      {
        onSuccess: (data: { version: string }) => {
          toast.success('Version uploaded', {
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
          toast.error(getErrorMessage(error, 'Failed to upload version'))
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload New Version</DialogTitle>
          <DialogDescription>
            Upload a .zip build file for your application.
          </DialogDescription>
        </DialogHeader>
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
                  Install Locally
                </label>
                <select
                  id='install'
                  value={installOption}
                  onChange={(e) => setInstallOption(e.target.value as 'yes' | 'yes-force' | 'no')}
                  className='border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm'
                >
                  <option value='yes'>Yes</option>
                  <option value='yes-force'>Yes, force</option>
                  <option value='no'>No</option>
                </select>
              </div>
            )}
            {availableTracks.length > 0 && (
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Update Tracks</label>
                <div className='grid grid-cols-2 gap-2'>
                  {availableTracks.map((track) => (
                    <label key={track} className='flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors'>
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
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Version'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
