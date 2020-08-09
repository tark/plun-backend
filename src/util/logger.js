const tagLength = 20;

export default class Logger {

  constructor(tag) {
    this.tag = tag;
  }

  i = (message) => {
    console.log(`${this.pad(this.tag)} - ${message}`)
  }

  //
  pad = (tag) => {
    let result = '>'
    for (let i = 0; i < tagLength - tag.length; i++) {
      result += ' ';
    }
    result += tag;
    return result;
  }
}
