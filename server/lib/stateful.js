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

  resume(state) {
    this._sessions.resume(this._uuid, state)
  }

  [Symbol.asyncIterator]() {
    return this
  }

  async next() {
    if (this._done) return { done: true }

    let message = await this._nextMessage()
    if (message.data.crc) this._done = true

    return { value: message, done: false }
  }

  async _nextMessage() {
    let message = await this._sessions.drain(this._uuid)
    if (message) return message

    return this._sessions.put(this._uuid, (state) => {
      let value = this._stream.next().value
      let data  = { value }
      let crc   = this._updateCRC(state.crc, value)

      if (state.count === 1) data.crc = crc

      return [
        data,
        { crc, count: state.count - 1 }
      ]
    })
  }

  _updateCRC(crc, value) {
    let buffer = Buffer.alloc(4)
    buffer.writeUInt32BE(value)

    crc = crc32.buf(buffer, crc)
    while (crc < 0) crc += MAX_VALUE

    return crc
  }
}

module.exports = Stateful
