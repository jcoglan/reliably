"use strict"

const net = require("net")
const split = require("split")
const Handler = require("./handler")

const INTERVAL = 1000

class Server {
  constructor(sessions, options = {}) {
    this._sessions  = sessions
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
    let handler = new Handler(conn, this._sessions, this._interval)

    conn.pipe(split("\n")).on("data", (data) => {
      try {
        let message = JSON.parse(data)
        handler.update(message)
      } catch (e) {
        conn.end()
      }
    })
  }
}

module.exports = Server
