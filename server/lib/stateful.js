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
    this._last     = null
  }

  init(params) {
    let state = { ...params, crc: 0 }
    return this._sessions.register(this._uuid, state)
  }

  async resume(state) {
    await this._sessions.ack(this._uuid, state)
    this._last = state
  }

  ack(state) {
    return this._sessions.ack(this._uuid, state)
  }

  disconnect() {
    return this._sessions.disconnect(this._uuid)
  }

  [Symbol.asyncIterator]() {
    return this
  }

  async next() {
    if (this._done) return { done: true }

    let message = await this._nextMessage()
    this._last = message.id
    if (message.data.crc) this._done = true

    return { value: message, done: false }
  }

  async _nextMessage() {
    let message = await this._sessions.after(this._uuid, this._last)
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
