const Sessions = require("../lib/sessions")
const Stateful = require("../lib/stateful")

function* fakeRandom() {
  yield 552680663
  yield 4175747998
  yield 541024752
  yield 1760696672
  yield 3373646083
}

describe("Stateful app", () => {
  let stream

  beforeEach(() => {
    stream = new Stateful(new Sessions(), fakeRandom(), "42")
  })

  it("generates a random sequence of the requested length", async () => {
    stream.init({ count: 5 })

    let messages = []
    for await (let msg of stream) messages.push(msg)

    expect(messages).toEqual([
      { id: 1, data: { value: 552680663 } },
      { id: 2, data: { value: 4175747998 } },
      { id: 3, data: { value: 541024752 } },
      { id: 4, data: { value: 1760696672 } },
      { id: 5, data: { value: 3373646083, crc: 4038291058 } }
    ])
  })

  it("generates a random sequence of a shorter length", async () => {
    stream.init({ count: 3 })

    let messages = []
    for await (let msg of stream) messages.push(msg)

    expect(messages).toEqual([
      { id: 1, data: { value: 552680663 } },
      { id: 2, data: { value: 4175747998 } },
      { id: 3, data: { value: 541024752, crc: 2867902066 } }
    ])
  })
})
