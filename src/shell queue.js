import { spawn } from 'child_process'

/**
 * A fifo queue of all discrete shell commands/scripts.
 * executes up to config.concurrentCmds concurrently
 *
 * @class ShellQueue
 * @extends {Array}
 */
export default class ShellQueue extends Array {
  constructor(shellHarness, ...items) {
    super(...items)
    this._shellHarness = shellHarness
    this.state = 'init'
    this.commandsRunning = 0
    if (this.shellHarness.logger) {
      this.shellHarness.logger.info(
        `Spawning process: ${shellHarness.config.shell}`,
        'ShellQueue',
      )
    }
    try {
      this._process = spawn(
        shellHarness.config.shell,
        shellHarness.config.spawnArgs,
        shellHarness.config.spawnOptions,
      )
    } catch (exception) {
      if (this.shellHarness.logger) {
        this.shellHarness.logger.error(
          `initialize, exception thrown: ${exception} ${exception.stack}`,
          'ShellQueue',
        )
      }
      throw exception
    }
    this._pid = this._process.pid
    if (this.shellHarness.logger) {
      this.shellHarness.logger.info(
        `Process: ${shellHarness.config.shell} PID: ${this._pid}`,
        'ShellQueue',
      )
    }

    this._process.stderr.on('data', (data) => {
      const [cmd] = this
      const dataString = data.toString()
      if (this.shellHarness.logger) {
        this.shellHarness.logger.error(
          `cmd: ${cmd.command} returned stderr: ${dataString}`,
          'ShellQueue',
        )
      }
      this.handleCommandFinished(
        true,
        new Error(
          `cmd: ${cmd.command} returned stderr: ${dataString}. ShellHarness doesn't support stderr, only stdout use { cmd; }2>&1;`,
        ),
      )
    })
    this._process.stdout.on('data', (data) => this.onData(data))
    this._process.on('message', (message) => this.onMessage(message))
    this._process.on('close', (code, signal) => {
      if (this.shellHarness.logger) {
        this.shellHarness.logger.info(
          `child process received close. code:${code} signal:${signal}`,
          'ShellQueue',
        )
      }
      this.state = 'closed'
    })
    this._process.on('error', (error) => {
      if (this.shellHarness.logger) {
        this.shellHarness.logger.error(
          `child process received error ${error}`,
          'ShellQueue',
        )
      }
      this.state = 'error'
      throw new Error(error)
    })
    this._process.on('exit', (code, signal) => {
      if (this.shellHarness.logger) {
        this.shellHarness.logger.info(
          `child process exit - code:${code} signal:${signal}`,
          'ShellQueue',
        )
      }
      this.state = 'exited'
    })
    this.state = 'online'
  }

  enqueue(command) {
    this.push(command)
    command.commandIFace.emit('enqueued', command.commandIFace)
    this.topUpExecution()
  }

  get shellHarness() {
    return this._shellHarness
  }

  get process() {
    return this._process
  }

  get stdin() {
    return this._process.stdin
  }

  shutdown() {
    this.process.stdout.removeAllListeners()
    this.state = 'shutdown'
    this.process.kill()
    this.forEach((command) => command.cancel())
    while (this.length > 0)
      this.pop()
  }

  onData(data) {
    let [cmd] = this
    const dataStr = data.toString()
    let doneIdx = dataStr.indexOf(cmd.doneMarker, 0) - 1
    if (doneIdx === -2)
      cmd.receiveData(dataStr)
    else {
      let startIdx = 0

      while (doneIdx >= 0) {
        if (doneIdx !== 0) cmd.receiveData(dataStr.substring(startIdx, doneIdx))
        this.handleCommandFinished(dataStr.substr(doneIdx, 1) !== '0');
        [cmd] = this
        if (cmd) {
          startIdx = doneIdx + cmd.doneMarker.length + 1
          doneIdx = dataStr.indexOf(cmd.doneMarker, startIdx) - 1
        } else
          doneIdx = -1
      }
      if (startIdx < dataStr.length && cmd)
        cmd.receiveData(dataStr.slice(startIdx))
    }
  }

  onMessage(message) {
    this[0].handleMessage(message)
  }

  handleCommandFinished(inError, failPayload = undefined) {
    const cmd = this.shift()
    this.commandsRunning -= 1
    this.topUpExecution()
    if (failPayload) cmd.fail(failPayload)
    else cmd.finish(inError)
  }

  topUpExecution() {
    if (this.length <= this.commandsRunning) return // all commands are running
    // too many commands are running
    if (this.commandsRunning >= this.shellHarness.config.concurrentCmds) return
    const cmd = this[this.commandsRunning]
    this.commandsRunning += 1
    cmd.run(this)
    this.topUpExecution()
  }
}
