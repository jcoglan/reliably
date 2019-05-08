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
        client.write("{}\n")
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
        client.write(JSON.stringify({ state: "616" }) + "\n")
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
        client.write(JSON.stringify({ uuid: "42", params: { count: 3 } }) + "\n")
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
        client.write(JSON.stringify({ uuid: "42", params: { count: 5 } }) + "\n")
        await take(3, client)

        client.write(JSON.stringify({ uuid: "42", state: 1 }) + "\n")
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
        client.write(JSON.stringify({ uuid: "42", params: { count: 5 } }) + "\n")
        await take(5, client)

        client.write(JSON.stringify({ uuid: "42", state: 2 }) + "\n")
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
        client.write(JSON.stringify({ uuid: "42", params: { count: 5 } }) + "\n")
        await take(5, client)

        client.write(JSON.stringify({ uuid: "42", state: 2 }) + "\n")
        await take(3, client)

        client.write(JSON.stringify({ uuid: "42", state: 3 }) + "\n")
      })

      it("returns unacked messages including the CRC", async () => {
        let messages = await take(2, client)

        expect(messages).toEqual([
          { id: 4, data: { value: 3312814729 } },
          { id: 5, data: { value: 81561450, crc: 3324646952 } }
        ])
      })
    })
  })
})
