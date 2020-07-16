/* eslint-disable no-param-reassign */
import CommandIFace from './commandIFace.js'

let markerCounter = 0

/**
 *
 *
 * @class Command
 *
 * any discrete command/script to execute on the shell.  Commands are promises that fulfil once
 *  done. Or reject if cancelled.  Commands also emit events as they progress:
 *
 * created - after first being created
 *
 * enqueued - once added to a ShellQueue
 *
 * executing- after command is sent to shell
 *
 * data - after data is received from the shell (returns data received)
 *
 * cancelled - after command is cancelled
 *
 * finished - after shell has finished executing command
 *
 * If an `Elevator` is provided then the command can elevate on fail.
 */
export default class Command {
  /**
   * creates a new promise that will execute the provided command
   *
   * @param {ShellHarness} [shellHarness]
   * @param {String} [command] - the command to run terminated by a semi-colon ;
   * @param {Object} [doneCBPayload] - an object to pass to the doneCallback function
   * @param {Function} [doneCallback] - callback function before command is completed
   * @param {Boolean} [autoDone]
   * @param {ShellQueue} [shellQueue]
   * @returns {CommandIFace} a promise that will resolve once the command is completed
   */
  constructor(
    shellHarness,
    command,
    doneCBPayload,
    doneCallback,
    autoDone,
    shellQueue,
  ) {
    this.commandIFace = new CommandIFace(this)
    this.shellHarness = shellHarness
    this.shellQueue = shellQueue
    this.command = command
    markerCounter += 1
    this.doneMarker = `${
      shellHarness.config.doneMarker
    }${markerCounter.toString().padStart(7, '0')}@`
    this.output = ''
    this.error = undefined
    this.dataFirstReceivedAt = undefined
    this.completed = false
    this.createdAt = new Date()
    this.startedAt = undefined
    this.finishedAt = undefined
    this.doneCallback = doneCallback
    this.doneCBPayload = doneCBPayload
    this.state = 'created'
    this.autoDone = autoDone
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
    return this.commandIFace
  }

  then(...args) {
    (async () => {
      try {
        this.enqueuedAt = new Date()
        this.state = 'enqueued'
        if (this.shellQueue)
          this.shellQueue.enqueue(this)
        else
          await this.shellHarness.enqueue(this)
      } catch (e) {
        this.fail(e)
      }
    })()
    return this.promise.then(...args)
  }

  catch(...args) {
    return this.promise.catch(...args)
  }

  run(shellQueue) {
    this.shellQueue = shellQueue
    const cmd = this.autoDone
      ? `{ ${this.command} } 2>&1;\nprintf $?${this.doneMarker};\n`
      : this.command
    if (this.shellHarness.logger) this.shellHarness.logger.debug(cmd, 'CMD')
    this.state = 'executing'
    this.startedAt = new Date()
    this.shellQueue.stdin.write(cmd)
    this.commandIFace.emit('executing', this.commandIFace)
  }

  sendDoneMarker() {
    this.shellQueue.stdin.write(`printf $?${this.doneMarker};\n`)
  }

  finish(inError) {
    if (this.shellHarness.logger) {
      this.shellHarness.logger.log(
        inError ? 'error' : 'debug',
        this.output,
        'CMDOUTPUT',
      )
    }
    this.error = inError
    this.finishedAt = new Date()
    this.state = 'finished'
    this.resolve(
      this.doneCallback
        ? this.doneCallback(this, this.doneCBPayload)
        : {
          error: this.error,
          command: this.command,
          output: this.output,
        },
    )
  }

  fail(error) {
    this.state = 'failed'
    this.commandIFace.emit('failed', this.commandIFace)
    this.reject(error)
  }

  cancel() {
    this.state = 'cancelled'
    this.commandIFace.emit('cancelled', this.commandIFace)
    this.reject(new Error('cancelled'))
  }

  receiveData(dataString) {
    this.output += dataString
    if (!this.dataFirstReceivedAt) this.dataFirstReceivedAt = new Date()
    this.state = 'receiving data'
    this.commandIFace.emit('data', dataString)
  }

  handleMessage(message) {
    if (this.shellHarness.logger)
      this.shellHarness.logger.debug(message, 'CMDHMSG')
    this.commandIFace.emit('message', message)
  }

  /**
   * sends an IPC message
   *
   * @param {String} message
   * @returns
   * @memberof Command
   */
  sendMessage(message) {
    if (this.shellHarness.logger)
      this.shellHarness.logger.debug(message, 'CMDSMSG')
    this.shellQueue.process.send(message)
  }

  // /**
  //  * sends an IPC message
  //  *
  //  * @param {Stream} stream
  //  * @returns
  //  * @memberof Command
  //  */
  // pipe(stream) {
  //   this.shellQueue.process.stdio[4].pipe(stream) // readable => writable
  // }
}
