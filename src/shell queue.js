import {glob} from './globals'

const {spawn} = require('child_process')
const logger = require('../config/winston')

/**
 * A fifo queue of all discrete shell commands/scripts.
 * executes up to config.concurrentCmds concurrently
 *
 * @class ShellQueue
 * @extends {Array}
 */
export default class ShellQueue extends Array {
  constructor(shellQueuePool, ...items) {
    super(...items)
    this._shellQueuePool = shellQueuePool
    this.state = 'init'
    this.commandsRunning = 0
    if (glob.log)
      logger.info({
        message: `Spawning process: ${shellQueuePool.config.shell}`,
        label: 'ShellQueue'
      })
    try {
      this._process = spawn(
        shellQueuePool.config.shell,
        shellQueuePool.config.spawnArgs,
        shellQueuePool.config.spawnOptions
      )
    } catch (exception) {
      logger.error({
        message: `initialize, exception thrown: ${exception} ${exception.stack}`,
        label: 'ShellQueue'
      })
      throw exception
    }
    this._pid = this._process.pid
    if (glob.log)
      logger.info({
        message: `Process: ${shellQueuePool.config.shell} PID: ${this._pid}`,
        label: 'ShellQueue'
      })

    this._process.stderr.on('data', data => this.onData(data, false))
    this._process.stdout.on('data', data => this.onData(data))
    this._process.on('message', message => this.onMessage(message))
    this._process.on('close', (code, signal) => {
      if (glob.log)
        logger.info({
          message: `child process received close.  code:${code} signal:${signal}`,
          label: 'ShellQueue: close'
        })
      this.state = 'closed'
    })
    this._process.on('error', err => {
      logger.error({
        message: `child process received error ${err}`,
        label: 'ShellQueue: error'
      })
      this.state = 'error'
      throw new Error(err)
    })
    this._process.on('exit', (code, signal) => {
      if (glob.log)
        logger.info({
          message: `child process received exit; code:${code} signal:${signal}`,
          label: 'ShellQueue: exit'
        })
      this.state = 'exited'
    })
    this.state = 'online'
  }

  enqueue(command) {
    this.push(command)
    command.commandIFace.emit('enqueued', command.commandIFace)
    this.topUpExecution()
  }

  get shellQueuePool() {
    return this._shellQueuePool
  }

  get process() {
    return this._process
  }

  get stdin() {
    return this._process.stdin
  }

  shutdown() {
    this.state = 'shutdown'
    this.process.kill('SIGHUP')
    this.forEach(command => {
      command.cancel()
    })
    while (this.length > 0) {
      this.pop()
    }
  }

  onData(data, stdout = true) {
    let [cmd] = this
    const dataStr = data.toString()
    if (!stdout && dataStr !== 'PaxsWord') throw new Error('unexpected stderr')

    let doneIdx = dataStr.indexOf(cmd.doneMarker, 0) - 1
    if (doneIdx === -2) {
      cmd.receiveData(dataStr)
    } else {
      let startIdx = 0

      while (doneIdx >= 0) {
        if (doneIdx !== 0) cmd.receiveData(dataStr.substring(startIdx, doneIdx))
        this.handleCommandFinished(dataStr.substr(doneIdx, 1) !== '0')
        ;[cmd] = this
        if (cmd) {
          startIdx = doneIdx + cmd.doneMarker.length + 1
          doneIdx = dataStr.indexOf(cmd.doneMarker, startIdx) - 1
        } else {
          doneIdx = -1
        }
      }
      if (startIdx < dataStr.length && cmd)
        cmd.receiveData(dataStr.slice(startIdx))
    }
  }

  onMessage(message) {
    this[0].handleMessage(message)
  }

  handleCommandFinished(inError) {
    const cmd = this.shift()
    this.commandsRunning -= 1
    this.topUpExecution()
    cmd.finish(inError)
  }

  topUpExecution() {
    if (this.length <= this.commandsRunning) return // all commands are running
    if (this.commandsRunning >= this.shellQueuePool.config.concurrentCmds)
      return // too many commands are running
    const cmd = this[this.commandsRunning]
    this.commandsRunning += 1
    cmd.run(this)
    this.topUpExecution()
  }
}
