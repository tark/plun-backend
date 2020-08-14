import chalk from 'chalk'

const tagLength = 20;

export default class Logger {
  tag: string

  constructor(tag: string) {
    this.tag = tag;
  }

  i = (message: string) => {
    console.log(`${this.pad(this.tag)} - ${message}`)
  }

  e = (message: string) => {
    console.log(chalk.red(`${this.pad(this.tag)} - ${message}`))
  }

  //
  pad = (tag: string) => {
    let result = '>'
    for (let i = 0; i < tagLength - tag.length; i++) {
      result += ' ';
    }
    result += tag;
    return result;
  }
}
