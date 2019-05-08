"use strict"

const MAX_BASE = 0xff

class Stateless {
  static seed() {
    return 1 + Math.floor(Math.random() * MAX_BASE)
  }

  static random() {
    return new Stateless(this.seed(), false)
  }

  static resume(value) {
    return new Stateless(value, true)
  }

  constructor(value, resumed = false) {
    this._value = BigInt(value)
    if (resumed) this._skip()
  }

  async *stream() {
    while (true) {
      yield { data: this._value.toString(10) }
      this._skip()
    }
  }

  _skip() {
    this._value *= BigInt(2)
  }
}

module.exports = Stateless
