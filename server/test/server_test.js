const net = require("net")
const split = require("split")

const Server = require("../lib/server")
const Sessions = require("../lib/sessions")
const Stateful = require("../lib/stateful")
const Stateless = require("../lib/stateless")

const HOST = "localhost"
const PORT = 4180

function* fakeRandom() {
  yield 3683752105
  yield 2660240414
  yield 2348159389
  yield 688321144
  yield 1537739762
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
    describe("with a new client", () => {
      beforeEach(() => {
        spyOn(Stateful, "random").and.returnValue(fakeRandom())
        client.write(JSON.stringify({ uuid: "42", params: { count: 3 } }) + "\n")
      })

      it("returns a stream ending with a checksum", async () => {
        let messages = await take(3, client)

        expect(messages).toEqual([
          { data: { value: 3683752105 } },
          { data: { value: 2660240414 } },
          { data: { value: 2348159389, crc: 4290727525 } }
        ])
      })
    })
  })
})
