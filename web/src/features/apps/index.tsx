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
  CardHeader,
  CardTitle,
  Input,
  Main,
  getErrorMessage,
  toast,
  CardSkeleton,
  Skeleton,
  EmptyState,
} from '@mochi/common'
import { Package, Plus } from 'lucide-react'
import { useAppsQuery, useCreateAppMutation } from '@/hooks/useApps'
import type { App } from '@/api/types/apps'

export function Apps() {
  usePageTitle('Publisher')
  const navigate = useNavigate()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const { data: apps, isLoading, ErrorComponent } = useAppsQuery()

  if (ErrorComponent) {
    return (
      <Main>
        <div className='mb-6 flex justify-end'>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Create app
          </Button>
        </div>
        {ErrorComponent}
      </Main>
    )
  }

  if (isLoading && !apps) {
    return (
      <Main>
        <div className='flex justify-end mb-6'>
          <Skeleton className='h-10 w-28' />
        </div>
        <CardSkeleton count={6} />
      </Main>
    )
  }

  return (
    <Main>
      <div className='mb-6 flex justify-end'>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className='mr-2 h-4 w-4' />
          Create app
        </Button>
      </div>

      {apps?.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No apps yet"
          description="Create your first app to get started"
        >
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Create app
          </Button>
        </EmptyState>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {apps?.map((app: App) => (
            <Card
              key={app.id}
              className='flex cursor-pointer flex-col transition-shadow hover:shadow-md'
              onClick={() => navigate({ to: '/app/$appId', params: { appId: app.id } })}
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
          navigate({ to: '/app/$appId', params: { appId: fingerprint } })
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
        onSuccess: (data: { id: string }) => {
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
          <DialogDescription className="sr-only">
            Create app
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
              {createMutation.isPending ? 'Creating...' : <><Plus className="mr-2 h-4 w-4" />Create app</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
