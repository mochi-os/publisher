const endpoints = {
  auth: {
    code: '/_/code',
    verify: '/_/verify',
    identity: '/_/identity',
    logout: '/_/logout',
  },
  apps: {
    list: 'list',
    get: (id: string) => `view?app=${id}`,
    create: 'create',
    uploadVersion: (id: string) => `${id}/version/create`,
    trackCreate: (id: string) => `${id}/track/create`,
    trackSet: (id: string) => `${id}/track/set`,
    trackDelete: (id: string) => `${id}/track/delete`,
    defaultTrackSet: (id: string) => `${id}/default-track/set`,
  },
} as const

export default endpoints
