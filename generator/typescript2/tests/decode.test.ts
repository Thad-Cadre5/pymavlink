import JSBI from "jsbi";
import * as mavlink from "../mavlink";
import {fromHex} from "./util";

////////////////////////////////////////////////////////////////////////////////

//Simple Heartbeat Message (v1)
const HEARTBEAT_V1 = "fe09807bd40004000000010203050142af";

//Simple Heartbeat Message (v2)
const HEARTBEAT_V2 = "fd090000807bd4000000040000000102030501c723";

//Range message with extension fields (v1) - Reads in v1 but extension fields omitted)
const GPS_RAW_INT_V1 = "fe32807bd41801000000000000000300000004000000050000000600070008000900020a0b0000000c0000000d0000000e0000000f000000e427";

//Range message with extension fields (v2)
const GPS_RAW_INT_V2 = "fd2f0000807bd418000001000000000000000300000004000000050000000600070008000900020a0b0000000c0000000d0000000e0000000f9c48";

//Status text message: 'DANGER WILL ROBINSON!'
const STATUS_TEXT = "fd160000807bd4fd00000244414e4745522057494c4c20524f42494e534f4e21c650";

//time_usec=8589934592, name='Testing123', array_id=99, data=[123.456] (x58)
const DEBUG_FLOAT_ARRAY = "fdfc0000807bd45e01000000000002000000630054657374696e6731323379e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f64279e9f642d874";

////////////////////////////////////////////////////////////////////////////////

test("Heartbeat_V1", () => {
    const data = fromHex(HEARTBEAT_V1);
    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(data);
    expect(messages).toHaveLength(1);

    const m = messages[0] as mavlink.IHEARTBEAT;

    expect(m.header.message_id).toBe(mavlink.MSG_ID.HEARTBEAT);
    expect(m.header.system_id).toBe(123);
    expect(m.header.component_id).toBe(212);
    expect(m.header.sequence).toBe(128);
    expect(m.header.is_mavlink_v2).toBeFalsy();

    expect(m.type).toBe(1);
    expect(m.autopilot).toBe(2);
    expect(m.base_mode).toBe(3);
    expect(m.custom_mode).toBe(4);
    expect(m.system_status).toBe(5);
    expect(m.mavlink_version).toBe(1);
});

test("Heartbeat_V2", () => {
    const data = fromHex(HEARTBEAT_V2);
    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(data);
    expect(messages).toHaveLength(1);

    const m = messages[0] as mavlink.IHEARTBEAT;

    expect(m.header.message_id).toBe(mavlink.MSG_ID.HEARTBEAT);
    expect(m.header.system_id).toBe(123);
    expect(m.header.component_id).toBe(212);
    expect(m.header.sequence).toBe(128);
    expect(m.header.is_mavlink_v2).toBeTruthy();

    expect(m.type).toBe(1);
    expect(m.autopilot).toBe(2);
    expect(m.base_mode).toBe(3);
    expect(m.custom_mode).toBe(4);
    expect(m.system_status).toBe(5);
    expect(m.mavlink_version).toBe(1);
});

test("GPS_RAW_INT_V1", () => {
    const data = fromHex(GPS_RAW_INT_V1);
    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(data);
    expect(messages).toHaveLength(1);

    const m = messages[0] as mavlink.IGPS_RAW_INT;

    expect(m.header.message_id).toBe(mavlink.MSG_ID.GPS_RAW_INT);
    expect(m.header.system_id).toBe(123);
    expect(m.header.component_id).toBe(212);
    expect(m.header.sequence).toBe(128);
    expect(m.header.is_mavlink_v2).toBeFalsy();

    // mavlink.MAVLink_gps_raw_int_message(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15), force_mavlink1=True)
    // def __init__(self, time_usec, fix_type, lat, lon, alt, eph, epv, vel, cog, satellites_visible, alt_ellipsoid=0, h_acc=0, v_acc=0, vel_acc=0, hdg_acc=0)
    expect(JSBI.toNumber(m.time_usec)).toBe(1);
    expect(m.fix_type).toBe(2);
    expect(m.lat).toBe(3);
    expect(m.lon).toBe(4);
    expect(m.alt).toBe(5);
    expect(m.eph).toBe(6);
    expect(m.epv).toBe(7);
    expect(m.vel).toBe(8);
    expect(m.cog).toBe(9);
    expect(m.satellites_visible).toBe(10);

    expect(m.alt_ellipsoid).toBe(11);
    expect(m.h_acc).toBe(12);
    expect(m.v_acc).toBe(13);
    expect(m.vel_acc).toBe(14);
    expect(m.hdg_acc).toBe(15);
});

test("GPS_RAW_INT_V2", () => {
    const data = fromHex(GPS_RAW_INT_V2);
    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(data);
    expect(messages).toHaveLength(1);

    const m = messages[0] as mavlink.IGPS_RAW_INT;

    expect(m.header.message_id).toBe(mavlink.MSG_ID.GPS_RAW_INT);
    expect(m.header.system_id).toBe(123);
    expect(m.header.component_id).toBe(212);
    expect(m.header.sequence).toBe(128);
    expect(m.header.is_mavlink_v2).toBeTruthy();

    // mavlink.MAVLink_gps_raw_int_message(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15))
    // def __init__(self, time_usec, fix_type, lat, lon, alt, eph, epv, vel, cog, satellites_visible, alt_ellipsoid=0, h_acc=0, v_acc=0, vel_acc=0, hdg_acc=0)
    expect(JSBI.toNumber(m.time_usec)).toBe(1);
    expect(m.fix_type).toBe(2);
    expect(m.lat).toBe(3);
    expect(m.lon).toBe(4);
    expect(m.alt).toBe(5);
    expect(m.eph).toBe(6);
    expect(m.epv).toBe(7);
    expect(m.vel).toBe(8);
    expect(m.cog).toBe(9);
    expect(m.satellites_visible).toBe(10);

    expect(m.alt_ellipsoid).toBe(11);
    expect(m.h_acc).toBe(12);
    expect(m.v_acc).toBe(13);
    expect(m.vel_acc).toBe(14);
    expect(m.hdg_acc).toBe(15);
});

test("STATUSTEXT", () => {
    const data = fromHex(STATUS_TEXT);
    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(data);
    expect(messages).toHaveLength(1);

    const m = messages[0] as mavlink.ISTATUSTEXT;

    expect(m.header.message_id).toBe(mavlink.MSG_ID.STATUSTEXT);
    expect(m.header.system_id).toBe(123);
    expect(m.header.component_id).toBe(212);
    expect(m.header.sequence).toBe(128);
    expect(m.header.is_mavlink_v2).toBeTruthy();

    expect(m.severity).toBe(2);
    expect(m.text).toBe("DANGER WILL ROBINSON!");
});

test("DEBUG_FLOAT_ARRAY", () => {
    const data = fromHex(DEBUG_FLOAT_ARRAY);
    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(data);
    expect(messages).toHaveLength(1);

    const m = messages[0] as mavlink.IDEBUG_FLOAT_ARRAY;

    expect(m.header.message_id).toBe(mavlink.MSG_ID.DEBUG_FLOAT_ARRAY);
    expect(m.header.system_id).toBe(123);
    expect(m.header.component_id).toBe(212);
    expect(m.header.sequence).toBe(128);
    expect(m.header.is_mavlink_v2).toBeTruthy();

    expect(JSBI.equal(m.time_usec, JSBI.BigInt("8589934592"))).toBeTruthy;
    expect(m.name).toBe("Testing123");
    expect(m.array_id).toBe(99);
    expect(m.data).toHaveLength(58);
    expect(m.data[0]).toBeCloseTo(123.456, 3);
    expect(m.data[57]).toBeCloseTo(123.456, 3);
});

test("Leading Trash", () => {
    const data = fromHex("AABBCCDDEEFF" + HEARTBEAT_V1);
    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(data);
    expect(parser.trashBytes).toBe(6);
    expect(messages).toHaveLength(1);

    expect(messages[0].header.system_id).toBe(123);
    expect(messages[0].header.component_id).toBe(212);
    expect(messages[0].header.sequence).toBe(128);
});

test("Trailing Trash", () => {
    const data = fromHex(HEARTBEAT_V1 + "AABBCCDDEEFF");
    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(data);
    expect(parser.trashBytes).toBe(6);
    expect(messages).toHaveLength(1);
    expect(messages[0].header.system_id).toBe(123);
    expect(messages[0].header.component_id).toBe(212);
    expect(messages[0].header.sequence).toBe(128);
});

test("Combined Packets", () => {
    const data = fromHex(HEARTBEAT_V1 + HEARTBEAT_V2);
    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(data);
    expect(messages).toHaveLength(2);

    expect(messages[0].header.system_id).toBe(123);
    expect(messages[0].header.component_id).toBe(212);
    expect(messages[0].header.sequence).toBe(128);
    expect(messages[0].header.is_mavlink_v2).toBeFalsy();

    expect(messages[0].header.system_id).toBe(123);
    expect(messages[0].header.component_id).toBe(212);
    expect(messages[0].header.sequence).toBe(128);
    expect(messages[1].header.is_mavlink_v2).toBeTruthy();
});

test("Packets with Trash", () => {
    const data = fromHex("AABBCCDDEEFF" + HEARTBEAT_V1 + "AABBCCDDEEFF" + HEARTBEAT_V2 + "AABBCCDDEEFF");
    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(data);
    expect(messages).toHaveLength(2);

    expect(messages[0].header.system_id).toBe(123);
    expect(messages[0].header.component_id).toBe(212);
    expect(messages[0].header.sequence).toBe(128);
    expect(messages[0].header.is_mavlink_v2).toBeFalsy();

    expect(messages[1].header.system_id).toBe(123);
    expect(messages[1].header.component_id).toBe(212);
    expect(messages[1].header.sequence).toBe(128);
    expect(messages[1].header.is_mavlink_v2).toBeTruthy();
});