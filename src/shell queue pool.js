import {LOCAL} from './globals'
import Command from './command'
import ShellQueue from './shell queue'

const fsPromises = require('fs').promises

/**
 * A pool of ShellQueues - each ShellQueue has one shell.  Incoming commands/scripts
 * are allocated to ShellQueue by reference to number of currently running commands - so basic load balancing
 * Can also spawn a ShellQueuePool as root or other user if specified in config.
 * @export
 * @class ShellQueuePool
 */

const initShellQueue = async shellQueuePool => {
  const shellQueue = new ShellQueue(shellQueuePool)
  const initScript = await fsPromises.readFile(
    shellQueuePool.config.initScript,
    'utf8'
  )

  await new Command(
    shellQueuePool,
    initScript,
    undefined,
    undefined,
    undefined,
    shellQueue
  )

  if (!shellQueuePool.config.user) return shellQueue

  if (!shellQueuePool.config.rootPassword)
    throw new Error(LOCAL.rootPasswordRequiredToChangeUser)

  const sudo = new Command(
    shellQueuePool,
    `sudo --user=#${shellQueuePool.config.uid} --group=#${shellQueuePool.config.gid} -p PaxsWord -S su ${shellQueuePool.config.user};\n`,
    undefined,
    undefined,
    false,
    shellQueue
  )

  sudo.on('data', (runningCmd, stdout) => {
    if (stdout !== 'PaxsWord') {
      shellQueue.shutdown()
      if (stdout.includes('No passwd entry for user'))
        throw new Error(`${LOCAL.noSuchUser}: ${shellQueuePool.config.user}`)
      if (stdout.includes('Sorry, try again.'))
        throw new Error(`${LOCAL.wrongPassword}`)
      throw new Error(`login failed: ${stdout}`)
    }
    runningCmd.stdin.write(`${shellQueuePool.config.rootPassword}\n`)
    runningCmd.sendDoneMarker()
  })

  await sudo

  await new Command(
    shellQueuePool,
    initScript,
    undefined,
    undefined,
    undefined,
    shellQueue
  )

  const whoami = await new Command(
    shellQueuePool,
    'whoami;',
    undefined,
    undefined,
    undefined,
    shellQueue
  )

  if (whoami.output !== `${shellQueuePool.config.user}\n`) {
    shellQueue.shutdown()
    throw new Error(`not logged in as ${shellQueuePool.config.user}`)
  }
  return shellQueue
}
export default class ShellQueuePool {
  constructor(scriptRunner) {
    this._scriptRunner = scriptRunner
  }

  get scriptRunner() {
    return this._scriptRunner
  }

  get config() {
    return this._scriptRunner.config
  }

  async shells() {
    if (this._shells) return this._shells
    this._shells = await Promise.all(
      Array(this.config.numberOfProcesses)
        .fill()
        .map(() => initShellQueue(this))
    )
    delete this.config.rootPassword
    return this._shells
  }

  createCommand(command, elevatorCmdType, progressCallBack, autoDone = true) {
    const cmd = new Command(
      this,
      command,
      elevatorCmdType,
      elevatorCmdType ? this.config.elevator : undefined,
      autoDone
    )
    return cmd
  }

  async getQueue() {
    const shells = await this.shells()
    let min = shells[0].length + 1
    let shellQueue = {}
    shells.forEach(sQueue => {
      if (sQueue.length < min) {
        min = sQueue.length
        shellQueue = sQueue
      }
    })
    return shellQueue
  }

  close() {
    if (this._shells) {
      this._shells.forEach(queue => queue.shutdown())
      this._shells = undefined
    }
  }

  get runningCommands() {
    if (this._shells)
      return this._shells.reduce((a, b) => a + (b.length || 0), 0)
    return 0
  }
}
