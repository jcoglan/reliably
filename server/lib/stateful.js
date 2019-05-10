"use strict"

const crc32 = require("crc-32")
const Twister = require("mersenne-twister")

const MAX_VALUE = Math.pow(2, 32)

class Stateful {
  static random(seed) {
    if (seed === undefined) {
      return Math.floor(Math.random() * MAX_VALUE)
    } else {
      return new Twister(seed).random_int()
    }
  }

  constructor(sessions, uuid) {
    this._sessions = sessions
    this._uuid     = uuid
    this._last     = null
  }

  init(params) {
    let state = { ...params, value: Stateful.random(), crc: 0 }
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
      let value = Stateful.random(state.value)
      let crc   = this._updateCRC(state.crc, value)
      let data  = (state.count === 1) ? { value, crc } : { value }

      return [
        data,
        { count: state.count - 1, value, crc }
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
