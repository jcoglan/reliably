"use strict"

class Sessions {
  constructor() {
    this._clients = new Map()
  }

  async register(uuid, state) {
    let record = { id: 0, behind: 0, queue: [], state }
    this._clients.set(uuid, record)
  }

  async resume(uuid, id) {
    await this.ack(uuid, id, true)
  }

  async ack(uuid, id, commit = false) {
    let record = this._clients.get(uuid)
    let behind = record.id - id

    let { queue } = record
    queue.splice(0, queue.length - behind)

    if (commit) record.behind = behind
  }

  async drain(uuid) {
    let record = this._clients.get(uuid)
    if (record.behind === 0) return null

    let { queue } = record
    let message = queue[queue.length - record.behind]
    record.behind -= 1

    return JSON.parse(message)
  }

  async put(uuid, generate) {
    let record = this._clients.get(uuid)
    let [data, state] = generate(record.state)

    record.state = state

    let message = { id: ++record.id, data }
    record.queue.push(JSON.stringify(message))

    return message
  }
}

module.exports = Sessions
