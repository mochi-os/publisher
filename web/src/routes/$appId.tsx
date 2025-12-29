import { useState, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from '@mochi/common'
import { ArrowLeft, Upload, Copy, Check, Trash2, Plus, Star } from 'lucide-react'
import { toast } from 'sonner'
import {
  useAppQuery,
  useUploadVersionMutation,
  useCreateTrackMutation,
  useSetTrackMutation,
  useDeleteTrackMutation,
  useSetDefaultTrackMutation,
} from '@/hooks/useApps'

export const Route = createFileRoute('/$appId')({
  component: AppPage,
})

function AppPage() {
  const { appId } = Route.useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useAppQuery(appId)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleBack = () => {
    navigate({ to: '/' })
  }

  usePageTitle(data?.app?.name ?? 'App')

  if (isLoading) {
    return (
      <>
        <Header fixed>
          <h1 className='text-lg font-semibold'>Loading...</h1>
        </Header>
        <Main>
          <div className='flex h-64 items-center justify-center'>
            <div className='text-muted-foreground'>Loading app details...</div>
          </div>
        </Main>
      </>
    )
  }

  if (isError || !data || !data.app) {
    return (
      <>
        <Header fixed>
          <h1 className='text-lg font-semibold'>App not found</h1>
        </Header>
        <Main>
          <div className='flex h-64 items-center justify-center'>
            <div className='text-muted-foreground'>
              The requested app could not be found.
            </div>
          </div>
        </Main>
      </>
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
    <>
      <Header fixed>
        <Button variant='ghost' size='sm' onClick={handleBack} className='mr-2'>
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <h1 className='text-lg font-semibold'>{app.name}</h1>
      </Header>

      <Main>
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>App details</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Share</CardTitle>
              <CardDescription>
                Share this ID to allow others to install this app
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <TracksCard
            appId={appId}
            tracks={tracks}
            versions={versions}
            defaultTrack={app.default_track ?? 'production'}
          />

          {versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Versions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  {versions.map((version) => (
                    <div key={version.version} className='flex justify-between'>
                      <span className='font-mono text-sm'>
                        {version.version}
                      </span>
                      <span className='text-muted-foreground text-sm'>
                        {version.file}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Upload new version</CardTitle>
              <CardDescription>
                Upload a new version of your app as a zip file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className='mr-2 h-4 w-4' />
                Upload version
              </Button>
            </CardContent>
          </Card>
        </div>

        <UploadVersionDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          appId={appId}
          showInstallOption={administrator}
        />
      </Main>
    </>
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
    <>
      <Header fixed>
        <h1 className='text-lg font-semibold'>{app.name}</h1>
      </Header>

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
    </>
  )
}

function TracksCard({
  appId,
  tracks,
  versions,
  defaultTrack,
}: {
  appId: string
  tracks: { track: string; version: string }[]
  versions: { version: string }[]
  defaultTrack: string
}) {
  const [showAddTrack, setShowAddTrack] = useState(false)
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
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to create track'))
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
          toast.error(getErrorMessage(error, 'Failed to update track'))
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
          toast.error(getErrorMessage(error, 'Failed to delete track'))
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
          toast.error(getErrorMessage(error, 'Failed to set default track'))
        },
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracks</CardTitle>
        <CardDescription>
          Tracks allow users to follow a release channel (e.g., stable, beta)
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {tracks.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No tracks defined</p>
        ) : (
          <div className='space-y-2'>
            {tracks.map((track) => (
              <div
                key={track.track}
                className='flex items-center gap-2 py-1 px-2 rounded bg-muted/50'
              >
                <button
                  onClick={() => handleSetDefaultTrack(track.track)}
                  className='text-muted-foreground hover:text-foreground'
                  title={
                    track.track === defaultTrack
                      ? 'Default track'
                      : 'Set as default'
                  }
                >
                  <Star
                    className={`h-4 w-4 ${
                      track.track === defaultTrack
                        ? 'fill-yellow-500 text-yellow-500'
                        : ''
                    }`}
                  />
                </button>
                <span className='font-medium min-w-24'>{track.track}</span>
                <Select
                  value={track.version}
                  onValueChange={(v) => handleSetTrackVersion(track.track, v)}
                >
                  <SelectTrigger className='w-32 h-8'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.version} value={v.version}>
                        {v.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => handleDeleteTrack(track.track)}
                  disabled={track.track === defaultTrack}
                  title={
                    track.track === defaultTrack
                      ? 'Cannot delete default track'
                      : 'Delete track'
                  }
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </div>
            ))}
          </div>
        )}

        {showAddTrack ? (
          <div className='flex items-center gap-2 pt-2 border-t'>
            <Input
              placeholder='Track name'
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              className='w-32'
            />
            <Select value={newTrackVersion} onValueChange={setNewTrackVersion}>
              <SelectTrigger className='w-32'>
                <SelectValue placeholder='Version' />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.version} value={v.version}>
                    {v.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size='sm'
              onClick={handleCreateTrack}
              disabled={!newTrackName || !newTrackVersion || createTrackMutation.isPending}
            >
              Add
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                setShowAddTrack(false)
                setNewTrackName('')
                setNewTrackVersion('')
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant='outline'
            size='sm'
            onClick={() => setShowAddTrack(true)}
            disabled={versions.length === 0}
          >
            <Plus className='h-4 w-4 mr-2' />
            Add track
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function UploadVersionDialog({
  open,
  onOpenChange,
  appId,
  showInstallOption,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  showInstallOption: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [installOption, setInstallOption] = useState<'yes' | 'yes-force' | 'no'>('yes')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadMutation = useUploadVersionMutation()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a file')
      return
    }

    const install = installOption !== 'no'
    const force = installOption === 'yes-force'

    uploadMutation.mutate(
      { appId, file, install, force },
      {
        onSuccess: (data) => {
          toast.success('Version uploaded', {
            description: `Version ${data.version} has been created.`,
          })
          setFile(null)
          setInstallOption('yes')
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
