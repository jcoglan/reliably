"use strict"

const crc32 = require("crc-32")

const MAX_VALUE = Math.pow(2, 32)

class Stateful {
  static *random() {
    while (true) {
      yield Math.floor(Math.random() * MAX_VALUE)
    }
  }

  constructor(sessions, stream, uuid) {
    this._sessions = sessions
    this._stream   = stream
    this._uuid     = uuid
  }

  init(params) {
    let state = { ...params, crc: 0 }
    this._sessions.register(this._uuid, state)
  }

  async next() {
    if (this._done) return { done: true }

    let data = { value: this._stream.next().value }
    let crc  = null

    let message = await this._sessions.put(this._uuid, data, (state) => {
      this._updateCRC(state, data.value)

      state.count -= 1
      if (state.count === 0) crc = state.crc
    })

    if (crc) {
      message.data.crc = crc
      this._done = true
    }

    return { value: message, done: false }
  }

  [Symbol.asyncIterator]() {
    return this
  }

  _updateCRC(state, value) {
    let buffer = Buffer.alloc(4)
    buffer.writeUInt32BE(value)

    state.crc = crc32.buf(buffer, state.crc)
    while (state.crc < 0) state.crc += MAX_VALUE
  }
}

module.exports = Stateful
