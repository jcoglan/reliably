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

  it("generates a sequence from a random start", () => {
    let stream = new Stateless(0xc6).stream()
    let n = 10, values = []

    while (n--) values.push(stream.next().value)

    expect(values).toEqual([
      198n, 396n, 792n, 1584n, 3168n, 6336n, 12672n, 25344n, 50688n, 101376n
    ])
  })

  it("generates a sequence starting after a given value", () => {
    let stream = Stateless.resume("1584").stream()
    let n = 6, values = []

    while (n--) values.push(stream.next().value)

    expect(values).toEqual([
      3168n, 6336n, 12672n, 25344n, 50688n, 101376n
    ])
  })
})
