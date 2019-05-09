"use strict"

const TIMEOUT = 30000

class Sessions {
  constructor() {
    this._clients = new Map()
  }

  async register(uuid, state) {
    let record = { id: 0, queue: [], state }
    this._clients.set(uuid, record)
  }

  async ack(uuid, id) {
    let record = this._get(uuid)
    if (record.timeout) clearInterval(record.timeout)

    let lag = record.id - id
    if (lag < 0) throw new Error(`Unknown message ID '${id}'`)

    let { queue } = record
    if (lag > queue.length) throw new Error("Out-of-order ACK")

    queue.splice(0, queue.length - lag)
  }

  async disconnect(uuid) {
    let record = this._get(uuid)
    if (record.timeout) return

    record.timeout = setTimeout(
        () => this._clients.delete(uuid),
        TIMEOUT)
  }

  async put(uuid, generate) {
    let record = this._get(uuid)
    let [data, state] = generate(record.state)

    record.state = state

    let message = { id: ++record.id, data }
    record.queue.push(JSON.stringify(message))

    return message
  }

  async after(uuid, id) {
    if (id === null) return null

    let record = this._get(uuid)
    if (id >= record.id) return null

    let lag = record.id - id
    let { queue } = record
    let message = queue[queue.length - lag]

    return JSON.parse(message)
  }

  _get(uuid) {
    let record = this._clients.get(uuid)
    if (!record) throw new Error(`Unknown client '${uuid}'`)

    return record
  }
}

module.exports = Sessions
