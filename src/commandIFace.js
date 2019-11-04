/* eslint-disable no-param-reassign */
import {EventEmitter} from 'events'

export default class CommandIFace extends EventEmitter {
  constructor(command) {
    super()
    this._command = command
  }

  then(...pmsArgs) {
    return this._command.promise.then(...pmsArgs)
  }

  /**
   * sends the doneMarker to complete the command
   *
   * @returns
   * @memberof CommandIFace
   */
  sendDoneMarker() {
    return this._command.sendDoneMarker()
  }

  /**
   * cancels this command
   *
   * @returns
   * @memberof CommandIFace
   */
  cancel() {
    return this._command.cancel()
  }

  /**
   * sends an IPC message
   *
   * @param {*} message
   * @returns
   * @memberof CommandIFace
   */
  sendMessage(message) {
    return this._command.sendMessage(message)
  }

  /**
   * the shellQueuePool this command belongs to
   *
   * @readonly
   * @memberof CommandIFace
   */
  get shellHarness() {
    return this._command.shellHarness
  }

  /**
   * the command string
   *
   * @readonly
   * @memberof CommandIFace
   */
  get command() {
    return this._command.command
  }

  /**
   * the done marker for this command
   *
   * @readonly
   * @memberof CommandIFace
   */
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

  /**
   * the stdin for a currently executing command
   *
   * @readonly
   * @memberof CommandIFace
   */
  get stdin() {
    return this._command.shellQueue.stdin
  }

  get doneCallback() {
    return this._command.doneCallback
  }

  get doneCBPayload() {
    return this._command.doneCBPayload
  }
}
