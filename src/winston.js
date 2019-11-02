/* eslint-disable no-shadow */
const {createLogger, format, transports} = require('winston')

// eslint-disable-next-line no-unused-vars
const {combine, timestamp, label, printf} = format

const myFormat = printf(({level, message, label, timestamp}) => {
  return `${timestamp} ${level} : ${label} : ${message}`
})

export default (logConfig, exceptionConfig) => {
  return createLogger({
    format: combine(timestamp(), myFormat),
    transports: [
      new transports.Console({
        level: 'debug',
        handleExceptions: true,
        json: true,
        colorize: true
      }),
      new transports.File(logConfig)
    ],
    exceptionHandlers: [new transports.File(exceptionConfig)]
  })
}
