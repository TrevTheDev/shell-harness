export const LOCAL = {
  wrongPassword: 'wrong password provided',
  noSuchUser: 'user not found',
  rootPasswordRequiredToChangeUser: 'root password required to change user',
}

export const DEFAULT_CONFIG = {
  shell: '/bin/sh',
  spawnArgs: [],
  spawnOptions: { stdio: ['pipe', 'pipe', 'pipe', 'ipc', 'pipe'] },

  initScript: undefined,

  doneCallback: undefined,

  user: undefined,
  rootPassword: undefined,

  numberOfProcesses: 4,
  concurrentCmds: 10,

  doneMarker: '__done__',

  sudoWait: 100,
}
