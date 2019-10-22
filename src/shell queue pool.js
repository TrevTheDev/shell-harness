import {LOCAL} from './globals'
import Command from './command'
import ShellQueue from './shell queue'

// const fsPromises = require('fs').promises

const initShellQueue = async shellQueuePool => {
  const shellQueue = new ShellQueue(shellQueuePool)

  if (shellQueuePool.config.user) {
    if (!shellQueuePool.config.rootPassword)
      throw new Error(LOCAL.rootPasswordRequiredToChangeUser)

    const sudo = new Command(
      shellQueuePool,
      `sudo -p PaxsWord -S su ${shellQueuePool.config.user};\n`,
      // `sudo --user=#${shellQueuePool.config.uid} --group=#${shellQueuePool.config.gid} -p PaxsWord -S su ${shellQueuePool.config.user};\n`,
      undefined,
      undefined,
      false,
      shellQueue
    )

    sudo.on('data', stdout => {
      if (stdout !== 'PaxsWord') {
        shellQueue.shutdown()
        if (stdout.includes('No passwd entry for user'))
          throw new Error(`${LOCAL.noSuchUser}: ${shellQueuePool.config.user}`)
        if (stdout.includes('Sorry, try again.'))
          throw new Error(`${LOCAL.wrongPassword}`)
        throw new Error(`login failed: ${stdout}`)
      }
      sudo.stdin.write(`${shellQueuePool.config.rootPassword}\n`)
      sudo.sendDoneMarker()
    })

    await sudo

    const whoami = await new Command(
      shellQueuePool,
      'whoami;',
      undefined,
      undefined,
      true,
      shellQueue
    )

    if (whoami.output !== `${shellQueuePool.config.user}\n`) {
      shellQueue.shutdown()
      throw new Error(`not logged in as ${shellQueuePool.config.user}`)
    }
  }

  if (shellQueuePool.config.initScript) {
    if (shellQueuePool.config.initScript instanceof Promise)
      // eslint-disable-next-line no-param-reassign
      shellQueuePool.config.initScript = await shellQueuePool.config.initScript

    await new Command(
      shellQueuePool,
      shellQueuePool.config.initScript,
      undefined,
      undefined,
      true,
      shellQueue
    )
  }

  return shellQueue
}

/**
 * A pool of ShellQueues - each ShellQueue has one shell.  Incoming commands/scripts
 * are allocated to ShellQueue by reference to number of currently running commands - so basic load balancing
 * Can also spawn a ShellQueuePool as root or other user if specified in config.
 * @export
 * @class ShellQueuePool
 */
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

  /**
   * creates a new promise that will execute the provided command
   *
   * @param {string} command - the command to run terminated by a semi-colon ;
   * @param {object} [doneCBPayload] - an object to pass to the doneCallback function
   * @param {function} [doneCallback=this.config.doneCallback] - callback function before command is completed
   * @returns {CommandIFace} a promise that will resolve once the command is completed
   * @memberof ShellQueuePool
   */
  createCommand(
    command,
    doneCBPayload,
    doneCallback = this.config.doneCallback
  ) {
    return new Command(this, command, doneCBPayload, doneCallback, true)
  }

  /**
   * creates a new promise that will execute the provided command.  To complete the promise you must send
   * cmd.sendDoneMarker()
   *
   * @param {string} command - the command to run terminated by a semi-colon ;
   * @param {object} [doneCBPayload] - an object to pass to the doneCallback function
   * @param {function} [doneCallback=this.config.doneCallback] - callback function before command is completed
   * @returns {CommandIFace} a promise that will resolve once the command is completed
   * @memberof ShellQueuePool
   */

  interact(command, doneCBPayload, doneCallback = this.config.doneCallback) {
    return new Command(this, command, doneCBPayload, doneCallback, false)
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

  /**
   * cancels all queued commands and shuts down all shells
   *
   * @memberof ShellQueuePool
   */
  close() {
    if (this._shells) {
      this._shells.forEach(queue => queue.shutdown())
      this._shells = undefined
    }
  }

  /**
   * number of commands currently executing
   *
   * @readonly
   * @memberof ShellQueuePool
   */
  get runningCommands() {
    return this._shells
      ? this._shells.reduce((a, b) => a + (b.length || 0), 0)
      : 0
  }
}
