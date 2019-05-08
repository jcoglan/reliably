let Stateless = require("../lib/stateless")

describe("Stateless app", () => {
  it("generates a seed from 1 to 0xff", () => {
    let n = 0xffff

    while (n--) {
      let v = Stateless.seed()
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThan(0x100)
    }
  })

  it("generates a sequence from a random start", async () => {
    let stream = new Stateless(0xc6).stream()
    let n = 10, values = []

    while (n--) values.push((await stream.next()).value.data)

    expect(values).toEqual([
      "198", "396", "792", "1584", "3168", "6336", "12672", "25344", "50688", "101376"
    ])
  })

  it("generates a sequence starting after a given value", async () => {
    let stream = Stateless.resume("1584").stream()
    let n = 6, values = []

    while (n--) values.push((await stream.next()).value.data)

    expect(values).toEqual([
      "3168", "6336", "12672", "25344", "50688", "101376"
    ])
  })
})
