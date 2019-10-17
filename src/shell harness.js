import ShellQueuePool from './shell queue pool'
import {DEFAULT_CONFIG, glob} from './globals'

/**
 *
 *
 * @export
 * @class ShellHarness
 * @param {object} config -
 * {
 *     shell: '/bin/sh',        // shell to use
 *
 *     initScript: undefined,   // script to run when shell is first launched
 *
 *     doneCallback: undefined, // callback before any command is completed
 *
 *     user: undefined,         // user to switch to via sudo then su
 *
 *     rootPassword: undefined, // root password to switch user
 *
 *     numberOfProcesses: 1,    // number of shells to spawn
 *
 *     concurrentCmds: 100,     // max number of commands to send to the shell at a time per shell
 *
 *     doneMarker: '__done__',  // unique identifier to determine whether command is completed - a sequential number is also added
 *
 *     log: true                // produce a log
 *   }
 * @returns {ShellQueuePool}
 */
export default class ShellHarness {
  constructor(config = {}) {
    this._config = {
      ...DEFAULT_CONFIG,
      ...config
    }
    glob.log = this.config.log
    this._shell = new ShellQueuePool(this)
    return this.shell
  }

  get shell() {
    return this._shell
  }

  get config() {
    return this._config
  }

  close() {
    if (this.shell) this.shell.close()
  }
}
