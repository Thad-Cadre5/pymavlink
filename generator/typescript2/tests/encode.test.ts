import JSBI from "jsbi";
import * as mavlink from "../mavlink";

test("Heartbeat", () => {
    const pkt = mavlink.build_packet(mavlink.MSG_ID.HEARTBEAT) as mavlink.IHEARTBEAT;
    pkt.type = mavlink.MAV_TYPE.MAV_TYPE_FLAPPING_WING;
    pkt.autopilot = mavlink.MAV_AUTOPILOT.MAV_AUTOPILOT_SLUGS;
    pkt.base_mode = mavlink.MAV_MODE_FLAG.MAV_MODE_FLAG_SAFETY_ARMED;
    pkt.custom_mode = 99;
    pkt.system_status = mavlink.MAV_STATE.MAV_STATE_CALIBRATING;
    pkt.mavlink_version = 2;

    const buf = mavlink.encode(pkt);

    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(buf);
    expect(messages).toHaveLength(1);
    
    const m = messages[0] as mavlink.IHEARTBEAT;
    expect(m.header.message_id).toBe(mavlink.MSG_ID.HEARTBEAT);
    expect(m.type).toBe(mavlink.MAV_TYPE.MAV_TYPE_FLAPPING_WING);
    expect(m.autopilot).toBe(mavlink.MAV_AUTOPILOT.MAV_AUTOPILOT_SLUGS);
    expect(m.base_mode).toBe(mavlink.MAV_MODE_FLAG.MAV_MODE_FLAG_SAFETY_ARMED);
    expect(m.custom_mode).toBe(99);
    expect(m.system_status).toBe(mavlink.MAV_STATE.MAV_STATE_CALIBRATING);
    expect(m.mavlink_version).toBe(2);
});


test("GLOBAL_POSITION_INT_COV", () => {

    const pkt = mavlink.build_packet(mavlink.MSG_ID.GLOBAL_POSITION_INT_COV) as mavlink.IGLOBAL_POSITION_INT_COV;
    pkt.time_usec = JSBI.BigInt(12345);
    pkt.estimator_type = mavlink.MAV_ESTIMATOR_TYPE.MAV_ESTIMATOR_TYPE_MOCAP;
    pkt.lat = 123456;
    pkt.lon = 654321;
    pkt.covariance.push(123.456, 99.55);

    const buf = mavlink.encode(pkt);

    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(buf);
    expect(messages).toHaveLength(1);
    
    const m = messages[0] as mavlink.IGLOBAL_POSITION_INT_COV;
    expect(m.header.message_id).toBe(mavlink.MSG_ID.GLOBAL_POSITION_INT_COV);
    expect(JSBI.toNumber(m.time_usec)).toBe(12345);
    expect(m.estimator_type).toBe(mavlink.MAV_ESTIMATOR_TYPE.MAV_ESTIMATOR_TYPE_MOCAP);
    expect(m.lat).toBe(123456);
    expect(m.lon).toBe(654321);

    expect(m.covariance[0]).toBeCloseTo(123.456, 3);
    expect(m.covariance[1]).toBeCloseTo(99.55, 2);
});

test("StatusText", () => {
    const pkt = mavlink.build_packet(mavlink.MSG_ID.STATUSTEXT_LONG) as mavlink.ISTATUSTEXT_LONG;
    pkt.severity = mavlink.MAV_SEVERITY.MAV_SEVERITY_ERROR;
    pkt.text = "Testing 1, 2, 3";

    const buf = mavlink.encode(pkt);

    const parser = new mavlink.Parser();
    const messages = parser.ParseBytes(buf);
    expect(messages).toHaveLength(1);
    
    const m = messages[0] as mavlink.ISTATUSTEXT_LONG;
    expect(m.header.message_id).toBe(mavlink.MSG_ID.STATUSTEXT_LONG);
    expect(m.severity).toBe(pkt.severity);
    expect(m.text).toBe(pkt.text);
});