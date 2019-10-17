/* eslint-disable no-param-reassign */
import {glob} from './globals'
import CommandIFace from './commandIFace'

const logger = require('../config/winston')

let markerCounter = 0

/**
 *
 *
 * @class Command
 *
 * any discrete command/script to execute on the shell.  Commands are promises that fulfil once done.  Or reject if cancelled.
 * Commands also emit events as they progress:
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
  constructor(
    shellQueuePool,
    command,
    doneCBPayload,
    doneCallback,
    autoDone,
    shellQueue
  ) {
    this.commandIFace = new CommandIFace(this)
    this.shellQueuePool = shellQueuePool
    this.command = command
    markerCounter += 1
    this.doneMarker = `${
      shellQueuePool.config.doneMarker
    }${markerCounter.toString().padStart(7, '0')}`
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
    // eslint-disable-next-line no-async-promise-executor
    this.promise = new Promise(async (success, fail) => {
      this.success = success
      this.fail = fail
      if (!shellQueue) shellQueue = await shellQueuePool.getQueue()
      this.enqueuedAt = new Date()
      this.state = 'enqueued'
      shellQueue.enqueue(this)
    })
    return this.commandIFace
  }

  run(shellQueue) {
    this.shellQueue = shellQueue
    const cmd = this.autoDone
      ? `{ ${this.command} } 2>&1;\nprintf $?${this.doneMarker};\n`
      : this.command
    if (glob.log)
      logger.debug({
        message: cmd,
        label: 'CMD'
      })
    this.state = 'executing'
    this.startedAt = new Date()
    this.shellQueue.stdin.write(cmd)
    this.commandIFace.emit('executing', this.commandIFace)
  }

  sendDoneMarker() {
    this.shellQueue.stdin.write(`printf $?${this.doneMarker};\n`)
  }

  finish(inError) {
    if (glob.log) {
      logger.log({
        level: inError ? 'error' : 'debug',
        message: this.output,
        label: 'CMDOUTPUT'
      })
    }
    this.error = inError
    this.finishedAt = new Date()
    this.state = 'finished'
    this.success(
      this.doneCallback
        ? this.doneCallback(this, this.doneCBPayload)
        : {
            error: this.error,
            command: this.command,
            output: this.output
          }
    )
  }

  cancel() {
    this.state = 'cancelled'
    this.commandIFace.emit('cancelled', this.commandIFace)
    this.fail(new Error('cancelled'))
  }

  handleData(dataString) {
    this.output += dataString
    if (!this.dataFirstReceivedAt) this.dataFirstReceivedAt = new Date()
    this.state = 'receiving data'
    this.commandIFace.emit('data', dataString)
  }

  handleMessage(message) {
    this.commandIFace.emit('message', message)
  }

  sendMessage(message) {
    this.shellQueue.process.send(message)
  }
}
