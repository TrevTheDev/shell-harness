/* eslint-disable no-param-reassign */
import {EventEmitter} from 'events'
import {glob} from './globals'

const logger = require('../config/winston')

let markerCounter = 0
/*
  #####  ####### #     # #     #    #    #     # ######  
 #     # #     # ##   ## ##   ##   # #   ##    # #     # 
 #       #     # # # # # # # # #  #   #  # #   # #     # 
 #       #     # #  #  # #  #  # #     # #  #  # #     # 
 #       #     # #     # #     # ####### #   # # #     # 
 #     # #     # #     # #     # #     # #    ## #     # 
  #####  ####### #     # #     # #     # #     # ######  
*/
/**
 *
 *
 * @class Command
 *
 * any discrete command/script to execute on the shell.  Commands are promises that fulfil once done.  Or reject if cancelled.
 * Commands also emit events as they progress:
 * started - after command is sent to shell
 * data - after data is received from the shell (returns data received)
 * cancelled - after command is cancelled
 * finished - after shell has finished executing command
 *
 * If an `Elevator` is provided then the command can elevate on fail.
 */
class CommandIFace extends EventEmitter {
  constructor(command) {
    super()
    this._command = command
  }

  then() {
    // eslint-disable-next-line prefer-rest-params
    return this._command.promise.then(...arguments)
  }

  sendDoneMarker() {
    return this._command.sendDoneMarker()
  }

  cancel() {
    return this._command.cancel()
  }

  get elevatorCmdType() {
    return this._command.elevatorCmdType
  }

  get command() {
    return this._command.command
  }

  get doneMarker() {
    return this._command.doneMarker
  }

  get createdAt() {
    return this._command.createdAt
  }

  get enqueuedAt() {
    return this._command.enqueuedAt
  }

  get startedAt() {
    return this._command.startedAt
  }

  get dataFirstReceivedAt() {
    return this._command.dataFirstReceivedAt
  }

  get finishedAt() {
    return this._command.finishedAt
  }

  get output() {
    return this._command.output
  }

  get error() {
    return this._command.error
  }

  get state() {
    return this._command.state
  }

  get autoDone() {
    return this._command.autoDone
  }

  get stdin() {
    return this._command.shellQueue.stdin
  }

  sendMessage(message) {
    return this._command.sendMessage(message)
  }
}

export default class Command {
  constructor(
    shellQueuePool,
    command,
    elevatorCmdType,
    elevator,
    autoDone = true,
    shellQueue = undefined
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
    this.elevatorCmdType = elevatorCmdType
    this.elevator = elevator
    this.state = 'created'
    this.autoDone = autoDone
    this.promise = new Promise(async (success, fail) => {
      this.success = success
      this.fail = fail
      if (!shellQueue) shellQueue = await shellQueuePool.getQueue()
      shellQueue.enqueue(this)
      this.enqueuedAt = new Date()
      this.state = 'enqueued'
      this.commandIFace.emit('enqueued', this.commandIFace)
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
    this.state = 'running'
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
    if (this.elevator && inError) {
      this.elevator.elevateIfRequired(this)
    } else {
      this.success({
        error: this.error,
        command: this.command,
        output: this.output
      })
      console.log(`${this.doneMarker}`) // @TODO: remove line
    }
  }

  cancel() {
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
