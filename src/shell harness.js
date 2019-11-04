import {DEFAULT_CONFIG, LOCAL} from './globals'
import Command from './command'
import ShellQueue from './shell queue'
import winston from './winston'

// const fsPromises = require('fs').promises

const initShellQueue = async shellHarness => {
  const shellQueue = new ShellQueue(shellHarness)

  if (shellHarness.config.user) {
    if (!shellHarness.config.rootPassword)
      throw new Error(LOCAL.rootPasswordRequiredToChangeUser)

    const sudo = new Command(
      shellHarness,
      `sudo -p PaxsWord -S su ${shellHarness.config.user} 2>&1 ;\n`,
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
          throw new Error(`${LOCAL.noSuchUser}: ${shellHarness.config.user}`)
        if (stdout.includes('Sorry, try again.'))
          throw new Error(`${LOCAL.wrongPassword}`)
        throw new Error(`login failed: ${stdout}`)
      }
      sudo.stdin.write(`${shellHarness.config.rootPassword}\n`)
      sudo.sendDoneMarker()
    })
    await sudo

    const whoami = await new Command(
      shellHarness,
      'whoami;',
      undefined,
      undefined,
      true,
      shellQueue
    )

    if (whoami.output !== `${shellHarness.config.user}\n`) {
      shellQueue.shutdown()
      throw new Error(`not logged in as ${shellHarness.config.user}`)
    }
  }

  if (shellHarness.config.initScript) {
    if (shellHarness.config.initScript instanceof Promise)
      // eslint-disable-next-line no-param-reassign
      shellHarness.config.initScript = await shellHarness.config.initScript

    await new Command(
      shellHarness,
      shellHarness.config.initScript,
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
 * Can also spawn a ShellQueues as root or other user if specified in config.
 * @export
 * @class ShellHarness
 */
export default class ShellHarness {
  constructor(config) {
    this._config = {
      ...DEFAULT_CONFIG,
      ...config
    }
    if (this.config.log)
      this.winston = winston(
        this.config.winstonLog,
        this.config.winstonExceptionLog
      )
  }

  get config() {
    return this._config
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
   * @param {function} [sendToEveryShell=false] - send this command to every shell
   * @returns {CommandIFace} a promise that will resolve once the command is completed
   * @memberof ShellHarness
   */
  createCommand(
    command,
    doneCBPayload,
    doneCallback = this.config.doneCallback,
    sendToEveryShell = false
  ) {
    if (!sendToEveryShell)
      return new Command(this, command, doneCBPayload, doneCallback, true)
    return (async () => {
      const shells = await this.shells()
      return Promise.all(
        shells.map(shell => {
          return new Command(
            this,
            command,
            doneCBPayload,
            doneCallback,
            true,
            shell
          )
        })
      )
    })()
  }

  /**
   * creates a new promise that will execute the provided command.  To complete the promise you must send
   * cmd.sendDoneMarker()
   *
   * @param {string} command - the command to run terminated by a semi-colon ;
   * @param {object} [doneCBPayload] - an object to pass to the doneCallback function
   * @param {function} [doneCallback=this.config.doneCallback] - callback function before command is completed
   * @returns {CommandIFace} a promise that will resolve once the command is completed
   * @memberof ShellHarness
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
   * @memberof ShellHarness
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
   * @memberof ShellHarness
   */
  get runningCommands() {
    return this._shells
      ? this._shells.reduce((a, b) => a + (b.length || 0), 0)
      : 0
  }
}
