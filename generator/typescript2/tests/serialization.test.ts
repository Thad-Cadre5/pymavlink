import JSBI from "jsbi";
import {unpack} from "../mavlink";
import {fromHex} from "./util";

//Value: 123.456, Format string: 'f'
const SINGLE_FLOAT = "79e9f642";

//Value: 123.456, Format string: '3f'
const FLOAT_ARRAY = "79e9f64279e9f64279e9f642";

//Value: 123.456, Format string: '32f'
const FLOAT_ARRAY_32 = "79e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f642";

//Value: 12345, Format string: 'h'
const INT_16 = "3930";

//Value: 48000, Format string: 'H'
const UINT_16 = "80bb";

//Value: Hello Worlds, Format string: '12c'
const STRING_VALUE = "48656c6c6f20576f726c6473";

//Value: Hello Worlds\0\0\0, Format string: '15c'
const STRING_WITH_NULL = "48656c6c6f20576f726c6473000000";

test("Single Float", () => {
    const data = new DataView(fromHex(SINGLE_FLOAT));
    const o = unpack(data, "f", ["value"]);
    expect(o).toHaveProperty("value");
    expect(o.value).toBeCloseTo(123.456, 3);
});

test("Float Array", () => {
    const data = new DataView(fromHex(FLOAT_ARRAY));
    const o = unpack(data, "3f", ["value"]);
    expect(o).toHaveProperty("value");
    expect(o.value).toHaveLength(3)
    expect(o.value[1]).toBeCloseTo(123.456, 3);
});

test("Float Array32", () => {
    const data = new DataView(fromHex(FLOAT_ARRAY_32));
    const o = unpack(data, "32f", ["value"]);
    expect(o).toHaveProperty("value");
    expect(o.value).toHaveLength(32)
    expect(o.value[31]).toBeCloseTo(123.456, 3);
});

test("INT_16", () => {
    const data = new DataView(fromHex(INT_16));
    const o = unpack(data, "h", ["value"]);
    expect(o).toHaveProperty("value");
    expect(o.value).toBe(12345);
});

test("UINT_16", () => {
    const data = new DataView(fromHex(UINT_16));
    const o = unpack(data, "H", ["value"]);
    expect(o).toHaveProperty("value");
    expect(o.value).toBe(48000);
});

test("String", () => {
    const data = new DataView(fromHex(STRING_VALUE));
    const o = unpack(data, "12c", ["value"]);
    expect(o).toHaveProperty("value");
    expect(o.value).toBe("Hello Worlds");
});

test("String with null", () => {
    const data = new DataView(fromHex(STRING_WITH_NULL));
    const o = unpack(data, "15c", ["value"]);
    expect(o).toHaveProperty("value");
    expect(o.value).toBe("Hello Worlds");
});
