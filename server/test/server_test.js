const net = require("net")
const split = require("split")

const Server = require("../lib/server")
const Sessions = require("../lib/sessions")
const Stateful = require("../lib/stateful")
const Stateless = require("../lib/stateless")

const HOST = "localhost"
const PORT = 4180

function* fakeRandom() {
  yield 2130920970
  yield 4113587094
  yield 1956217341
  yield 3312814729
  yield 81561450
}

function take(n, stream) {
  return new Promise((resolve, reject) => {
    let messages = []

    stream.pipe(split("\n")).on("data", (data) => {
      try {
        messages.push(JSON.parse(data))
        if (--n === 0) resolve(messages)
      } catch (e) {}
    })
  })
}

describe("server", () => {
  let server, client

  function send(message) {
    client.write(JSON.stringify(message) + "\n")
  }

  beforeEach((done) => {
    server = new Server(new Sessions(), { interval: 10 })

    server.listen(PORT, HOST, () => {
      client = net.connect(PORT, HOST, done)
    })
  })

  afterEach((done) => {
    client.end()
    server.close(done)
  })

  describe("stateless protocol", () => {
    describe("with a new client", () => {
      beforeEach(() => {
        spyOn(Stateless, "seed").and.returnValue(0x9a)
        send({})
      })

      it("returns a stream starting from a random seed", async () => {
        let messages = await take(5, client)

        expect(messages).toEqual([
          { data: "154" },
          { data: "308" },
          { data: "616" },
          { data: "1232" },
          { data: "2464" }
        ])
      })
    })

    describe("with a reconnecting client", () => {
      beforeEach(() => {
        send({ state: "616" })
      })

      it("returns a stream starting from the given state", async () => {
        let messages = await take(5, client)

        expect(messages).toEqual([
          { data: "1232" },
          { data: "2464" },
          { data: "4928" },
          { data: "9856" },
          { data: "19712" }
        ])
      })
    })
  })

  describe("stateful protocol", () => {
    beforeEach(() => {
      spyOn(Stateful, "random").and.returnValue(fakeRandom())
    })

    describe("with a new client", () => {
      beforeEach(() => {
        send({ uuid: "42", params: { count: 3 } })
      })

      it("returns a stream ending with a checksum", async () => {
        let messages = await take(3, client)

        expect(messages).toEqual([
          { id: 1, data: { value: 2130920970 } },
          { id: 2, data: { value: 4113587094 } },
          { id: 3, data: { value: 1956217341, crc: 1653556597 } }
        ])
      })
    })

    describe("with a reconnecting client", () => {
      beforeEach(async () => {
        send({ uuid: "42", params: { count: 5 } })
        await take(3, client)

        send({ uuid: "42", state: 1 })
      })

      it("returns messages the client has not acked", async () => {
        let messages = await take(2, client)

        expect(messages).toEqual([
          { id: 2, data: { value: 4113587094 } },
          { id: 3, data: { value: 1956217341 } }
        ])
      })

      it("completes the stream after catching the client up", async () => {
        let messages = await take(4, client)

        expect(messages.slice(2)).toEqual([
          { id: 4, data: { value: 3312814729 } },
          { id: 5, data: { value: 81561450, crc: 3324646952 } }
        ])
      })
    })

    describe("when a client reconnects after the stream has ended", () => {
      beforeEach(async () => {
        send({ uuid: "42", params: { count: 5 } })
        await take(5, client)

        send({ uuid: "42", state: 2 })
      })

      it("returns unacked messages including the CRC", async () => {
        let messages = await take(3, client)

        expect(messages).toEqual([
          { id: 3, data: { value: 1956217341 } },
          { id: 4, data: { value: 3312814729 } },
          { id: 5, data: { value: 81561450, crc: 3324646952 } }
        ])
      })
    })

    describe("when a client reconnects multiple times", () => {
      beforeEach(async () => {
        send({ uuid: "42", params: { count: 5 } })
        await take(5, client)

        send({ uuid: "42", state: 2 })
        await take(3, client)

        send({ uuid: "42", state: 3 })
      })

      it("returns unacked messages including the CRC", async () => {
        let messages = await take(2, client)

        expect(messages).toEqual([
          { id: 4, data: { value: 3312814729 } },
          { id: 5, data: { value: 81561450, crc: 3324646952 } }
        ])
      })
    })

    describe("when the client acknowledges a past message", () => {
      beforeEach(async () => {
        send({ uuid: "42", params: { count: 5 } })
        await take(3, client)
        send({ uuid: "42", ack: 2 })
      })

      it("delivers the remaining messages without replay", async () => {
        let messages = await take(2, client)

        expect(messages).toEqual([
          { id: 4, data: { value: 3312814729 } },
          { id: 5, data: { value: 81561450, crc: 3324646952 } }
        ])
      })
    })

    it("returns an error if an unknown client reconnects", async () => {
      send({ uuid: "42", state: 1 })

      let messages = await take(1, client)

      expect(messages).toEqual([
        { error: "Unknown client '42'" }
      ])
    })

    it("returns an error if an ack is sent first", async () => {
      send({ uuid: "42", ack: 1 })

      let messages = await take(1, client)

      expect(messages).toEqual([
        { error: "Cannot send ACK as the first message" }
      ])
    })

    it("returns an error if the client ACKs an unsent message", async () => {
      send({ uuid: "42", params: { count: 5 } })
      send({ uuid: "42", ack: 1 })

      let messages = await take(1, client)

      expect(messages).toEqual([
        { error: "Unknown message ID '1'" }
      ])
    })

    it("returns an error if the client ACKs an old message", async () => {
      send({ uuid: "42", params: { count: 5 } })
      await take(2, client)
      send({ uuid: "42", ack: 2 })
      send({ uuid: "42", ack: 1 })

      let messages = await take(1, client)

      expect(messages).toEqual([
        { error: "Out-of-order ACK" }
      ])
    })
  })
})
