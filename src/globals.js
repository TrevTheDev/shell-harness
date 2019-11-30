export const LOCAL = {
  wrongPassword: 'wrong password provided',
  noSuchUser: 'user not found',
  rootPasswordRequiredToChangeUser: 'root password required to change user'
}

export const DEFAULT_CONFIG = {
  shell: '/bin/sh',
  spawnOptions: {stdio: ['pipe', 'pipe', 'pipe', 'ipc', 'pipe']},

  initScript: undefined,

  doneCallback: undefined,

  user: undefined,
  rootPassword: undefined,

  numberOfProcesses: 1,
  concurrentCmds: 100,

  doneMarker: '__done__',

  log: true,
  winstonLog: {
    level: 'debug',
    filename: `./logs/app.log`,
    handleExceptions: true,
    maxsize: 5242880, // 5MB
    maxFiles: 1,
    colorize: false,
    options: {flags: 'w'}
  },
  winstonExceptionLog: {
    filename: './logs/exceptions.log'
  }
}
