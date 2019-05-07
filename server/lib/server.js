"use strict"

const net = require("net")
const stateless = require("./stateless")

const INTERVAL = 1000

class Server {
  constructor(options = {}) {
    this._interval  = options.interval || INTERVAL
    this._netServer = net.createServer()

    this._netServer.on("connection", (conn) => this._handle(conn))
  }

  listen(port, host, done) {
    this._netServer.listen(port, host, done)
  }

  close(done) {
    this._netServer.close(done)
  }

  _handle(conn) {
    let stream = stateless.random().stream()

    function count() {
      let message = { data: stream.next().value.toString(10) }
      conn.write(JSON.stringify(message) + "\n")
    }

    let timer = setInterval(count, this._interval)

    conn.on("close", () => clearInterval(timer))
    conn.on("error", () => {})
  }
}

module.exports = Server
