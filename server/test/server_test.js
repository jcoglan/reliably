const net = require("net")
const split = require("split")

const Server = require("../lib/server")
const Stateless = require("../lib/stateless")

const HOST = "localhost"
const PORT = 4180

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
    server = new Server({ interval: 10 })

    server.listen(PORT, HOST, () => {
      client = net.connect(PORT, HOST, done)
    })
  })

  afterEach((done) => {
    client.end()
    server.close(done)
  })

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
