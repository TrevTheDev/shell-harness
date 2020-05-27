import {DEFAULT_CONFIG, LOCAL} from './globals.js'
import Command from './command.js'
import ShellQueue from './shell queue.js'

let sudoWait = 50

const confirmUser = async (shellQueue, user) => {
  const whoami = await new Command(
    shellQueue.shellHarness,
    'whoami;',
    undefined,
    undefined,
    true,
    shellQueue
  )
  if (whoami.output !== `${user}\n`) {
    shellQueue.shutdown()
    throw new Error(`not logged in as ${user}`)
  }
}

const sudoInteractionHandler = (
  shellQueue,
  sudoCmd,
  stdout,
  user,
  password
) => {
  if (stdout !== 'PaxsWord') {
    let msg
    if (stdout.includes('No passwd entry for user'))
      msg = `${LOCAL.noSuchUser}: ${user}`
    else if (stdout.includes('Sorry, try again.'))
      msg = `${LOCAL.wrongPassword}`
    else msg = `login failed: ${stdout}`
    // sudo._command.fail()
    // reject(new Error(msg))
    shellQueue.handleCommandFinished(true, new Error(msg))
  } else {
    setTimeout(() => {
      sudoCmd.stdin.write(`${password}\n`)
      sudoCmd.sendDoneMarker()
    }, sudoWait)
  }
}

const sudo = (shellQueue, user, password) => {
  return new Promise((resolve, reject) => {
    const sudoCmd = new Command(
      shellQueue.shellHarness,
      `sudo -K && sudo -p PaxsWord -S su ${user} 2>&1 ;\n`,
      undefined,
      undefined,
      false,
      shellQueue
    )
    sudoCmd.on('data', stdout =>
      sudoInteractionHandler(shellQueue, sudoCmd, stdout, user, password)
    )
    sudoCmd
      .then(() => {
        resolve(confirmUser(shellQueue, user))
      })
      .catch(error => {
        shellQueue.shutdown()
        reject(error)
      })
  })
}

const initScript = async shellQueue => {
  const {shellHarness} = shellQueue
  if (shellHarness.config.initScript) {
    if (shellHarness.config.initScript instanceof Promise)
      shellHarness.config.initScript = await shellHarness.config.initScript
    try {
      await new Command(
        shellHarness,
        shellHarness.config.initScript,
        undefined,
        undefined,
        true,
        shellQueue
      )
    } catch (error) {
      shellQueue.shutdown()
      throw error
    }
  }
}

const initShellQueue = async shellHarness => {
  const shellQueue = new ShellQueue(shellHarness)

  if (shellHarness.config.user) {
    if (!shellHarness.config.rootPassword)
      throw new Error(LOCAL.rootPasswordRequiredToChangeUser)
    await sudo(
      shellQueue,
      shellHarness.config.user,
      shellHarness.config.rootPassword
    )
  }

  await initScript(shellQueue)

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
    if (this.config.logger) {
      this.logger = this.config.logger
    }

    if (this.config.sudoWait) sudoWait = this.config.sudoWait
  }

  get config() {
    return this._config
  }

  async shells() {
    if (this._shells) return this._shells
    if (this.spawningShellsPromise) this.spawningShellsPromise
    const shells = []
    const cnt = this.config.numberOfProcesses
    for (let step = 0; step < cnt; step += 1) {
      shells.push(initShellQueue(this)) // slow sequential process is required by sudo command
    }
    this.spawningShellsPromise = new Promise(resolve=>{
      try {
        Promise.all(shells).then(shellArray => {
          this._shells = shellArray
          delete this.spawningShellsPromise
          resolve(shellArray)
        })
      } catch (error) {
        this.close()
        throw error
      } finally {
        delete this.config.rootPassword
      }
    })
    return this.spawningShellsPromise
  }

  /**
   * creates a new promise that will execute the provided command
   *
   * @param {String} [command] - the command to run terminated by a semi-colon ;
   * @param {Object} [doneCBPayload] - an object to pass to the doneCallback function
   * @param {Function} [doneCallback=this.config.doneCallback] - callback function before command is completed
   * @param {Boolean} [sendToEveryShell=false] - send this command to every shell
   * @returns {CommandIFace} a promise that will resolve once the command is completed
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
    try {
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
    } catch (e) {
      throw e
    }
  }

  /**
   * cancels all queued commands and shuts down all shells
   *
   * @memberof ShellHarness
   */
  close() {
    if (this._shells && this._shells.constructor.name !== 'Error') {
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
