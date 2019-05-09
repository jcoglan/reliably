"use strict"

const stateful = require("./stateful")
const stateless = require("./stateless")

class Handler {
  constructor(conn, sessions, interval) {
    this._conn     = conn
    this._sessions = sessions
    this._interval = interval

    conn.on("close", () => this._disconnect())
    conn.on("error", () => {})
  }

  async update(message) {
    try {
      if (message.uuid) {
        await this._updateStateful(message)
      } else {
        await this._updateStateless(message)
      }
    } catch (error) {
      this._conn.write(JSON.stringify({ error: error.message }) + "\n")
    }
  }

  _updateStateless({ state }) {
    if (this._stream) return

    if (state) {
      this._stream = stateless.resume(state).stream()
    } else {
      this._stream = stateless.random().stream()
    }

    this._startEmit()
  }

  async _updateStateful({ uuid, params, state, ack }) {
    if (ack) {
      if (!this._stream) throw new Error("Cannot send ACK as the first message")
      return this._stream.ack(ack)
    }

    this._stream = new stateful(this._sessions, stateful.random(), uuid)

    if (params) await this._stream.init(params)
    if (state) await this._stream.resume(state)

    this._startEmit()
  }

  _startEmit() {
    if (this._timer) return

    this._timer = setInterval(() => this._emit(), this._interval)
    this._conn.on("close", () => clearInterval(this._timer))
  }

  async _emit() {
    let message = await this._stream.next()
    this._conn.write(JSON.stringify(message.value) + "\n")
  }

  _disconnect() {
    if (this._stream && this._stream.disconnect) {
      this._stream.disconnect()
    }
  }
}

module.exports = Handler
