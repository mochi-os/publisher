import { useState, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
} from '@mochi/common'
import { Upload, Copy, Check, Plus, MoreHorizontal } from 'lucide-react'
import {sortVersionsDesc} from '@/lib/version'
import {
  useAppQuery,
  useUploadVersionMutation,
  useCreateTrackMutation,
  useSetTrackMutation,
  useDeleteTrackMutation,
  useSetDefaultTrackMutation,
} from '@/hooks/useApps'

export const Route = createFileRoute('/_authenticated/app/$appId')({
  component: AppPage,
})

function AppPage() {
  const { appId } = Route.useParams()
  const { data, isLoading, isError } = useAppQuery(appId)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showAddTrack, setShowAddTrack] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'versions' | 'tracks'>('details')

  usePageTitle(data?.app?.name ?? 'App')

  if (isLoading) {
    return (
      <Main>
        <div className='flex h-64 items-center justify-center'>
          <div className='text-muted-foreground'>Loading app details...</div>
        </div>
      </Main>
    )
  }

  if (isError || !data || !data.app) {
    return (
      <Main>
        <div className='flex h-64 items-center justify-center'>
          <div className='text-muted-foreground'>
            The requested app could not be found.
          </div>
        </div>
      </Main>
    )
  }

  const { app, tracks, versions, administrator, share, publisher } = data

  // Build share string: just app ID for public, app@publisher for private
  const shareString = app.privacy === 'public' ? app.id : `${app.id}@${publisher}`

  // Show share page for unauthenticated users or non-admins
  if (share) {
    return <SharePage app={app} tracks={tracks} shareString={shareString} copied={copied} setCopied={setCopied} />
  }

  // Show management page for administrators
  return (
    <Main className='space-y-6'>
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
          <Button onClick={() => setShowUploadDialog(true)} className='mb-2'>
            <Upload className='mr-2 h-4 w-4' />
            Upload new version
          </Button>
        )}
        {activeTab === 'tracks' && versions.length > 0 && (
          <Button variant='outline' size='sm' onClick={() => setShowAddTrack(true)} className='mb-2'>
            <Plus className='h-4 w-4 mr-2' />
            New track
          </Button>
        )}
      </div>

      <div>
        {activeTab === 'details' && (
          <div className='space-y-6'>
            <div className='space-y-3'>
              <div>
                <span className='font-medium'>ID:</span>{' '}
                <span className='font-mono text-sm'>{app.id}</span>
              </div>
              <div>
                <span className='font-medium'>Fingerprint:</span>{' '}
                <span className='font-mono text-sm'>{app.fingerprint}</span>
              </div>
              <div>
                <span className='font-medium'>Privacy:</span>{' '}
                <span className='capitalize'>{app.privacy}</span>
              </div>
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>Share</label>
              <p className='text-muted-foreground text-sm'>
                Share this ID to allow others to install this app
              </p>
              <div className='flex items-center gap-2'>
                <Input
                  readOnly
                  value={shareString}
                  className='font-mono text-sm'
                />
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => {
                    navigator.clipboard.writeText(shareString)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                    toast.success('App ID copied to clipboard')
                  }}
                >
                  {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <div className='space-y-4'>
            {versions.length === 0 ? (
              <p className='text-muted-foreground text-sm'>No versions uploaded yet</p>
            ) : (
              <div className='space-y-2'>
                {sortVersionsDesc(versions).map((version) => (
                  <div key={version.version} className='flex justify-between py-1 px-2 rounded bg-muted/50'>
                    <span className='font-mono text-sm'>
                      {version.version}
                    </span>
                    <span className='text-muted-foreground text-sm'>
                      {version.file}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
  )
}

function SharePage({
  app,
  tracks,
  shareString,
  copied,
  setCopied,
}: {
  app: { id: string; name: string; privacy: string; fingerprint?: string }
  tracks: { track: string; version: string }[]
  shareString: string
  copied: boolean
  setCopied: (v: boolean) => void
}) {
  return (
    <Main>
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Install this app</CardTitle>
              <CardDescription>
                Copy this ID and paste it in your Mochi server's Apps page to install
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>App ID</label>
                <Input readOnly value={shareString} className='font-mono text-sm' />
              </div>
              <Button
                variant='outline'
                className='w-full'
                onClick={() => {
                  navigator.clipboard.writeText(shareString)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                  toast.success('Copied to clipboard')
                }}
              >
                {copied ? <Check className='mr-2 h-4 w-4' /> : <Copy className='mr-2 h-4 w-4' />}
                Copy app ID
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>App details</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div>
                <span className='font-medium'>Fingerprint:</span>{' '}
                <span className='font-mono text-sm'>{app.fingerprint}</span>
              </div>
              <div>
                <span className='font-medium'>Privacy:</span>{' '}
                <span className='capitalize'>{app.privacy}</span>
              </div>
            </CardContent>
          </Card>

          {tracks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Available version</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  {tracks.map((track) => (
                    <div key={track.track} className='flex justify-between'>
                      <span className='font-medium'>{track.track}</span>
                      <span className='font-mono text-sm'>{track.version}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
    </Main>
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
  const [newTrackVersion, setNewTrackVersion] = useState('')

  const createTrackMutation = useCreateTrackMutation()
  const setTrackMutation = useSetTrackMutation()
  const deleteTrackMutation = useDeleteTrackMutation()
  const setDefaultTrackMutation = useSetDefaultTrackMutation()

  const handleCreateTrack = () => {
    if (!newTrackName || !newTrackVersion) return
    createTrackMutation.mutate(
      { appId, track: newTrackName, version: newTrackVersion },
      {
        onSuccess: () => {
          toast.success('Track created')
          setNewTrackName('')
          setNewTrackVersion('')
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
    <div className='space-y-4'>
      {tracks.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No tracks defined</p>
      ) : (
        <div className='space-y-2'>
          {tracks.map((track) => (
            <div
              key={track.track}
              className='flex items-center justify-between py-1 px-2 rounded bg-muted/50'
            >
              <span className='font-medium'>
                {track.track}
                {track.track === defaultTrack && (
                  <span className='text-muted-foreground font-normal'> (default)</span>
                )}
              </span>
              <div className='flex items-center gap-2'>
                <Select
                  value={track.version}
                  onValueChange={(v) => handleSetTrackVersion(track.track, v)}
                >
                  <SelectTrigger className='w-32 h-8'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortVersionsDesc(versions).map((v) => (
                      <SelectItem key={v.version} value={v.version}>
                        {v.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='sm'>
                      <MoreHorizontal className='h-4 w-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem
                      onClick={() => handleSetDefaultTrack(track.track)}
                      disabled={track.track === defaultTrack}
                    >
                      Set as default
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteTrack(track.track)}
                      disabled={track.track === defaultTrack}
                      variant='destructive'
                    >
                      Delete
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
            <DialogTitle>New track</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <label htmlFor='trackName' className='text-sm font-medium'>
                Track name
              </label>
              <Input
                id='trackName'
                value={newTrackName}
                onChange={(e) => setNewTrackName(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Version</label>
              <Select value={newTrackVersion} onValueChange={setNewTrackVersion}>
                <SelectTrigger>
                  <SelectValue placeholder='Select version' />
                </SelectTrigger>
                <SelectContent>
                  {sortVersionsDesc(versions).map((v) => (
                    <SelectItem key={v.version} value={v.version}>
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
              disabled={!newTrackName || !newTrackVersion || createTrackMutation.isPending}
            >
              <Plus className='h-4 w-4 mr-2' />
              {createTrackMutation.isPending ? 'Creating...' : 'Create track'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
        onSuccess: (data) => {
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
          <DialogTitle>Upload new version</DialogTitle>
          <DialogDescription>
            Upload a zip file containing your app
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <label htmlFor='file' className='text-sm font-medium'>
                File
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
                  Install locally
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
                <label className='text-sm font-medium'>Update tracks</label>
                <div className='space-y-2'>
                  {availableTracks.map((track) => (
                    <label key={track} className='flex items-center gap-2'>
                      <input
                        type='checkbox'
                        checked={selectedTracks.includes(track)}
                        onChange={() => toggleTrack(track)}
                        className='h-4 w-4 rounded border-gray-300'
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
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
