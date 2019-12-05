export function encode(pkt: any): ArrayBuffer {

    const header = pkt.header as IMavlinkHeader;
    if (header == null) {
        throw new Error("Invalid MAVLink packet structure (header required)");
    }

    const pktDesc = MAVLINK_MESSAGE_DESCRIPTORS.get(header.message_id);
    if (pktDesc == null) {
        throw new Error(`Unknown MAVLink message id: ${header}`);
    }

    const maxPacketLen = pktDesc.len + MAVLINK_NUM_NON_PAYLOAD_BYTES;
    const backingBuf = new ArrayBuffer(maxPacketLen);
    const buf = new DataView(backingBuf);

    // Serialize the payload
    pack(pkt, buf, MAVLINK_NUM_HEADER_BYTES, pktDesc.format, pktDesc.fields);

    // Zero byte payload truncation (eliminate zeros at the end of the payload)
    let payloadLen = pktDesc.len;
    while(payloadLen > 1 && buf.getUint8(payloadLen +  MAVLINK2_HEADER_LEN) == 0) {
        payloadLen--;
    }

    // Header
    let incompat_flags = 0;

    buf.setUint8(0, MAVLINK_STX);                   // packet prefix
    buf.setUint8(1, payloadLen);                    // length
    buf.setUint8(2, incompat_flags);                // incompat flags
    buf.setUint8(3, 0);                             // compat flags
    buf.setUint8(4, header.sequence);               // sequence
    buf.setUint8(5, header.system_id);              // system id
    buf.setUint8(6, header.component_id);           // component id
    buf.setUint8(7, header.message_id & 0xFF);      // message id
    buf.setUint8(8, (header.message_id >> 8) & 0xFF);
    buf.setUint8(9, (header.message_id >> 16) & 0xFF);

    // CRC
    const crc = calculate_crc(buf, 1, MAVLINK2_HEADER_LEN + payloadLen, pktDesc.crc_extra);
    const crcIdx = MAVLINK_NUM_HEADER_BYTES +  payloadLen;
    buf.setUint16(crcIdx, crc, true);

    // TODO? packet signing

    const packetLen = MAVLINK_NUM_HEADER_BYTES + payloadLen + MAVLINK_NUM_CHECKSUM_BYTES;
    return buf.buffer.slice(0, packetLen);
}

function build_packet_default_field(typeCode: string, count: number): any {
    switch(typeCode) {
        case "f":
        case "d":
        case "b":
        case "h":
        case "H":
        case "i":
        case "I":
            return count > 1 ? [] : 0;
        case "c":
            return "";
        case "B":
            return count > 1 ? new ArrayBuffer(count) : 0;
        case "q":
        case "Q":
            return JSBI.BigInt(0);
    }
}

export function build_packet(msg_id: MSG_ID){
    const pktDesc = MAVLINK_MESSAGE_DESCRIPTORS.get(msg_id);
    if (pktDesc == null) {
        throw new Error(`Unknown MAVLink message id: ${msg_id}`);
    }
    const types = parseWireTypeString(pktDesc.format);
    let pkt = {} as any;

    for(let i=0; i < types.length; i++) {
        let field = pktDesc.fields[i];
        let typeDef = types[i];
        pkt[field] = build_packet_default_field(typeDef.code, typeDef.count);
    }

    pkt.header = {
        message_id: msg_id,
        system_id: 0,
        component_id: 0,
        sequence: 0,
        payload_length: pktDesc.len,
        is_mavlink_v2: true,
    };

    return pkt;
}
