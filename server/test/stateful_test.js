const Sessions = require("../lib/sessions")
const Stateful = require("../lib/stateful")

const FAKE_RANDOM = [
  0,
  552680663,
  4175747998,
  541024752,
  1760696672,
  3373646083
]

describe("Stateful app", () => {
  let stream

  beforeEach(() => {
    stream = new Stateful(new Sessions(), "42")

    let random = FAKE_RANDOM.slice()
    spyOn(Stateful, "random").and.callFake(() => random.shift())
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
