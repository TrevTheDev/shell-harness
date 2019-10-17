export const LOCAL = {
  wrongPassword: 'wrong password provided',
  noSuchUser: 'user not found',
  rootPasswordRequiredToChangeUser: 'root password required to change user'
}

export const DEFAULT_CONFIG = {
  shell: '/bin/sh',
  spawnOptions: {stdio: ['pipe', 'pipe', 'pipe', 'ipc']},

  initScript: undefined,

  doneCallback: undefined,

  user: undefined,
  rootPassword: undefined,

  numberOfProcesses: 1,
  concurrentCmds: 100,

  doneMarker: '__done__',

  log: true
}

export const glob = {}
