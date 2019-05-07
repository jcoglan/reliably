"use strict"

const stateless = require("./stateless")

class Handler {
  constructor(conn, interval) {
    this._conn = conn
    this._interval = interval
  }

  start({ state }) {
    if (this._stream) return

    if (state) {
      this._stream = stateless.resume(state).stream()
    } else {
      this._stream = stateless.random().stream()
    }

    let timer = setInterval(() => this._emit(), this._interval)

    this._conn.on("close", () => clearInterval(timer))
    this._conn.on("error", () => {})
  }

  _emit() {
    let value = this._stream.next().value
    let message = { data: value.toString(10) }
    this._conn.write(JSON.stringify(message) + "\n")
  }
}

module.exports = Handler
