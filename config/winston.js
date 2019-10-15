/* eslint-disable no-shadow */
const {createLogger, format, transports} = require('winston')

// eslint-disable-next-line no-unused-vars
const {combine, timestamp, label, printf} = format

const myFormat = printf(({level, message, label, timestamp}) => {
  return `${timestamp} ${level} : ${label} : ${message}`
})

module.exports = createLogger({
  format: combine(timestamp(), myFormat),
  transports: [
    new transports.Console({
      level: 'error',
      handleExceptions: true,
      json: true,
      colorize: true
    }),
    new transports.File({
      level: 'debug',
      filename: `./logs/app.log`,
      handleExceptions: true,
      maxsize: 5242880, // 5MB
      maxFiles: 1,
      colorize: false,
      options: {flags: 'w'}
    })
  ],
  exceptionHandlers: [
    new transports.File({
      filename: './logs/exceptions.log'
    })
  ]
})
