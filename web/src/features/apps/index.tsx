import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  usePageTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Main,
  getErrorMessage,
} from '@mochi/common'
import { Package, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAppsQuery, useCreateAppMutation } from '@/hooks/useApps'

export function Apps() {
  usePageTitle('Publisher')
  const navigate = useNavigate()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const { data: apps, isLoading } = useAppsQuery()

  if (isLoading && !apps) {
    return (
      <Main>
        <div className='flex h-64 items-center justify-center'>
          <div className='text-muted-foreground'>Loading apps...</div>
        </div>
      </Main>
    )
  }

  return (
    <Main>
      <div className='mb-6 flex justify-end'>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className='mr-2 h-4 w-4' />
          New app
        </Button>
      </div>

      {apps?.length === 0 ? (
        <Card>
          <CardContent className='py-12'>
            <div className='text-muted-foreground text-center'>
              <Package className='mx-auto mb-4 h-12 w-12 opacity-50' />
              <p className='text-lg font-medium'>No apps yet</p>
              <p className='mt-1 text-sm'>
                Create your first app to get started
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {apps?.map((app) => (
            <Card
              key={app.id}
              className='flex cursor-pointer flex-col transition-shadow hover:shadow-md'
              onClick={() => navigate({ to: '/$appId', params: { appId: app.id } })}
            >
              <CardHeader>
                <CardTitle className='truncate text-lg'>{app.name}</CardTitle>
                {app.version && (
                  <p className='text-muted-foreground text-sm'>{app.version}</p>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <CreateAppDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={(fingerprint) => {
          setShowCreateDialog(false)
          navigate({ to: '/$appId', params: { appId: fingerprint } })
        }}
      />
    </Main>
  )
}

function CreateAppDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [privacy, setPrivacy] = useState('public')
  const createMutation = useCreateAppMutation()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Please enter an app name')
      return
    }

    createMutation.mutate(
      { name: name.trim(), privacy },
      {
        onSuccess: (data) => {
          toast.success('App created', {
            description: `${name} has been created successfully.`,
          })
          setName('')
          setPrivacy('public')
          onSuccess(data.id)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to create app'))
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new app</DialogTitle>
          <DialogDescription>
            Create a new app to publish to others
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <label htmlFor='name' className='text-sm font-medium'>
                Name
              </label>
              <Input
                id='name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='My App'
              />
            </div>
            <div className='space-y-2'>
              <label htmlFor='privacy' className='text-sm font-medium'>
                Make app publicly available
              </label>
              <select
                id='privacy'
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
                className='border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm'
              >
                <option value='public'>Yes</option>
                <option value='private'>No</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create app'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
