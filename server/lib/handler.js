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

  _updateStateful({ uuid, params }) {
    if (this._stream) return

    this._stream = new stateful(this._sessions, stateful.random(), uuid)
    this._stream.init(params)

    this._startEmit()
  }

  _startEmit() {
    this._timer = setInterval(() => this._emit(), this._interval)
    this._conn.on("close", () => clearInterval(this._timer))
  }

  async _emit() {
    let message = await this._stream.next()
    this._conn.write(JSON.stringify(message.value) + "\n")
  }
}

module.exports = Handler
