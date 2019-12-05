import JSBI from "jsbi";
import {getInt64, getUint64, setUint64, setInt64} from "../mavlink";
import {fromHex} from "./util";

//INT64 = 0
const INT64_0 = "0000000000000000";

//INT64 = 5
const INT64_5 = "0500000000000000";

//INT64 = 77777777777777777
const INT64_7S = "711cdd0f7a521401";

//INT64 = 99999999999999999
const INT64_9S = "ffff895d78456301";

//INT64 = -5
const INT64_NEG_5 = "fbffffffffffffff";

//INT64 = -500000000
const INT64_NEG_500MIL = "009b32e2ffffffff";

//UINT64 = 99999999999999999
const UINT64_9S = "ffff895d78456301";

test("getInt64: Zero", () => {
    const data = new DataView(fromHex(INT64_0));
    const u64 = getInt64(data);
    expect(JSBI.toNumber(u64)).toBe(0);
});

test("getInt64: Five", () => {
    const data = new DataView(fromHex(INT64_5));
    const u64 = getInt64(data);
    expect(JSBI.toNumber(u64)).toBe(5);
});

test("getInt64: Sevens", () => {
    const data = new DataView(fromHex(INT64_7S));
    const u64 = getInt64(data);
    expect(JSBI.equal(u64, JSBI.BigInt("77777777777777777")) ).toBeTruthy();
});

test("getInt64: Nines", () => {
    const data = new DataView(fromHex(INT64_9S));
    const u64 = getInt64(data);
    expect(JSBI.equal(u64, JSBI.BigInt("99999999999999999")) ).toBeTruthy();
});

test("getInt64: -5", () => {
    const data = new DataView(fromHex(INT64_NEG_5));
    const u64 = getInt64(data);
    expect(JSBI.toNumber(u64)).toBe(-5);
});

test("getInt64: -50000", () => {
    const data = new DataView(fromHex(INT64_NEG_500MIL));
    const u64 = getInt64(data);
    expect(JSBI.toNumber(u64)).toBe(-500000000);
});

test("getUint64: Nines", () => {
    const data = new DataView(fromHex(UINT64_9S));
    const u64 = getUint64(data);
    expect(JSBI.equal(u64, JSBI.BigInt("99999999999999999")) ).toBeTruthy();
});

test("setUint64: Low", () => {
    const buf = new DataView(new ArrayBuffer(8));
    const value = JSBI.BigInt("32");

    // Round Trip
    setUint64(value, buf, 0);
    const ret = getUint64(buf);
    expect(JSBI.equal(ret, value)).toBeTruthy();
});

test("setUint64: High", () => {
    const buf = new DataView(new ArrayBuffer(8));
    const value = JSBI.BigInt("1099511627776");

    // Round Trip
    setUint64(value, buf, 0);
    const ret = getUint64(buf);
    expect(JSBI.equal(ret, value)).toBeTruthy();
});

test("setUint64: Low and High", () => {
    const buf = new DataView(new ArrayBuffer(8));
    const value = JSBI.BigInt("1099511627808");

    // Round Trip
    setUint64(value, buf, 0);
    const ret = getUint64(buf);
    expect(JSBI.equal(ret, value)).toBeTruthy();
});

test("setInt64: Low and High", () => {
    const buf = new DataView(new ArrayBuffer(8));
    const value = JSBI.BigInt("1099511627808");

    // Round Trip
    setInt64(value, buf, 0);
    const ret = getInt64(buf);
    expect(JSBI.equal(ret, value)).toBeTruthy();
});

test("setInt64: Negative", () => {
    const buf = new DataView(new ArrayBuffer(8));
    const value = JSBI.BigInt("-1099511627808");

    // Round Trip
    setInt64(value, buf, 0);
    const ret = getInt64(buf);
    expect(JSBI.equal(ret, value)).toBeTruthy();
});