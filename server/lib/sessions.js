"use strict"

class Sessions {
  constructor() {
    this._clients = new Map()
  }

  register(uuid, state) {
    let record = state
    this._clients.set(uuid, record)
  }

  put(uuid, data, update) {
    let record = this._clients.get(uuid)
    update(record)

    let message = { data }

    return Promise.resolve(message)
  }
}

module.exports = Sessions
