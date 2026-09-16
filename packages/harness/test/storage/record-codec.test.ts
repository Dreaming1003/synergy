import { expect, test } from "bun:test"
import { RecordCodec } from "../../src/storage/record-codec"

test("stores small values plainly and compresses repetitive records without changing JSON semantics", () => {
  for (const value of [null, false, 0, "z:literal", { optional: { unknown: true }, text: "你好 🌍".repeat(2000) }]) {
    const body = RecordCodec.encode(value)
    expect(RecordCodec.decode<typeof value>(body)).toEqual(value)
    if (typeof value === "object" && value) expect(Buffer.byteLength(body)).toBeLessThan(512)
    else expect(body).toBe(JSON.stringify(value))
  }
  expect(RecordCodec.decode<{ old: string }>(JSON.stringify({ old: "x".repeat(4096) }))).toEqual({
    old: "x".repeat(4096),
  })
})

test("corrupt compressed records fail with an integrity error", () => {
  const encoded = RecordCodec.encode({ text: "durable evidence".repeat(2000) })
  expect(() => RecordCodec.decode(encoded.slice(0, -4))).toThrow()
  expect(() => RecordCodec.decode("z:!!!!")).toThrow()
  expect(() => RecordCodec.encode(undefined)).toThrow()
})
