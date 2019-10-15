import ShellQueuePool from './shell queue pool'
import {DEFAULT_CONFIG, glob} from './globals'

export default class ScriptRunner {
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
