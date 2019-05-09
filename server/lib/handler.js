"use strict"

const stateful = require("./stateful")
const stateless = require("./stateless")

class Handler {
  constructor(conn, sessions, interval) {
    this._conn     = conn
    this._sessions = sessions
    this._interval = interval

    conn.on("error", () => {})
  }

  update(message) {
    if (message.uuid) {
      this._updateStateful(message)
    } else {
      this._updateStateless(message)
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

  _updateStateful({ uuid, params, state, ack }) {
    if (ack) return this._stream.ack(ack)

    this._stream = new stateful(this._sessions, stateful.random(), uuid)

    if (params) this._stream.init(params)
    if (state) this._stream.resume(state)

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
}

module.exports = Handler
