export const LOCAL = {
  wrongPassword: 'wrong password provided',
  noSuchUser: 'user not found',
  rootPasswordRequiredToChangeUser: 'root password required to change user'
}

export const DEFAULT_CONFIG = {
  shell: '/bin/sh',
  spawnArgs: ['-s'],
  spawnOptions: {stdio: ['pipe', 'pipe', 'pipe', 'ipc']},
  initScript: `${process.cwd()}/src/init.sh`,

  elevator: undefined,

  user: undefined,
  rootPassword: undefined,
  uid: undefined,
  gid: undefined,

  numberOfProcesses: 1,
  doneMarker: '__done__',
  concurrentCmds: 100,

  cmdDivider: '___EOC___',
  fileDivider: '___EOG___',

  log: true
}

export const glob = {}
