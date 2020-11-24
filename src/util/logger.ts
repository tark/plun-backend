import winston from 'winston'
import chalk from 'chalk'
import moment from 'moment'
import DailyRotateFile from 'winston-daily-rotate-file'

const tagLength = 20

export default class Logger {
  tag: string
  logger: winston.Logger

  constructor(tag: string) {
    this.tag = tag
    this.logger = this.createLogger(tag)
  }

  i = (message: string) => {
    this.logger.info(message)
  }

  e = (message: string) => {
    this.logger.error(message)
  }

  //
  pad = (tag: string) => {
    let result = '>'
    for (let i = 0; i < tagLength - tag.length; i++) {
      result += ' '
    }
    result += tag
    return result
  }

  createLogger = (label: string = 'General', filename?: string): winston.Logger => {
    const logsPath = process.env.LOGS_PATH || 'logs'

    const transports = []

    if (process.env.NODE_ENV !== 'production') {
      transports.push(new winston.transports.Console())
    }

    transports.push(new DailyRotateFile({
      dirname: logsPath,
      filename: `%DATE%-all.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      zippedArchive: true
    }))

    transports.push(new DailyRotateFile({
      dirname: logsPath,
      filename: `%DATE%-errors.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      zippedArchive: true
    }))

    if (filename) {
      transports.push(new DailyRotateFile({
        dirname: logsPath,
        filename: `%DATE%-${filename}.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        zippedArchive: true
      }))
    }

    return winston.createLogger({
      format: winston.format.combine(
        winston.format.label({label}),
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(info => {
          const {timestamp, level, label, message} = info
          const date = moment(timestamp).format('HH:mm:ss')
          let coloredMessage = level == 'error' ? chalk.red(message) : message
          return `${date}${chalk.grey(this.pad(label))} - ${coloredMessage}\n`
        })
      ),
      transports
    })

  }
}

