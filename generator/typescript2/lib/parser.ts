const MAVLINK_MAX_PAYLOAD_LEN = 255;
const MAVLINK_IFLAG_SIGNED = 0x01;

const MAVLINK2_HEADER_LEN = 9;  ///< Length of core header (of the comm. layer)
const MAVLINK1_HEADER_LEN = 5; ///< Length of MAVLink1 core header (of the comm. layer)
const MAVLINK_NUM_HEADER_BYTES = (MAVLINK2_HEADER_LEN + 1); ///< Length of all header bytes, including core and stx
const MAVLINK_NUM_CHECKSUM_BYTES = 2;
const MAVLINK_NUM_NON_PAYLOAD_BYTES = (MAVLINK_NUM_HEADER_BYTES + MAVLINK_NUM_CHECKSUM_BYTES);

const MAVLINK_SIGNATURE_BLOCK_LEN = 13;
const MAVLINK_MAX_PACKET_LEN = (MAVLINK_MAX_PAYLOAD_LEN + MAVLINK_NUM_NON_PAYLOAD_BYTES + MAVLINK_SIGNATURE_BLOCK_LEN); ///< Maximum packet length

const MAVLINK_STX = 0xFD;
const MAVLINK_STX_MAVLINK1 = 0xFE;

function calculate_crc(buf: DataView, byteOffset: number, length: number, crc_extra: number): number {
    let crc = 0xFFFF;
    for (let i=0; i < length; i++) {
        let x = buf.getUint8(i + byteOffset) ^ (crc & 0xFF);
        x = (x ^ (x << 4)) & 0xFF;
        crc = (crc >> 8) ^ (x << 8) ^ (x << 3) ^ (x >> 4);
    }

    let x = crc_extra ^ (crc & 0xFF);
    x = (x ^ (x << 4)) & 0xFF;
    crc = (crc >> 8) ^ (x << 8) ^ (x << 3) ^ (x >> 4);
    return crc;
}



export class Parser
{
    crcErrors = 0;
    unknownMessageTypes = 0;
    trashBytes = 0;
    parseErrors = 0;
    packetsParsed = 0;

    private residual?: Uint8Array;

    ParseBytes(buf: ArrayBuffer): any[] {

        const newMessages: any [] = [];

        let parseBuf: Uint8Array

        if (buf.byteLength === 0) {
            return newMessages;
        }

        if (this.residual == null) {
            parseBuf = new Uint8Array(buf);
        } else {
            parseBuf = new Uint8Array(this.residual.length + buf.byteLength);
            parseBuf.set(this.residual);
            parseBuf.set(new Uint8Array(buf), this.residual.length);
        }

        this.residual = undefined;
        let idx = 0;
        while(idx < parseBuf.length) {
            for (; idx < parseBuf.length && parseBuf[idx] != MAVLINK_STX && parseBuf[idx] != MAVLINK_STX_MAVLINK1; idx++){
                this.trashBytes++;
            }

            // Check for data left
            if (idx == parseBuf.length)
                break;

            // Create a slice in the parse buffer for our potential packet
            const pkt = new DataView(parseBuf.buffer, idx);

            const isMavlinkV2 = pkt.getUint8(0) == MAVLINK_STX;
            const headerLength = isMavlinkV2 ? MAVLINK2_HEADER_LEN : MAVLINK1_HEADER_LEN;

            if (pkt.byteLength < headerLength)
                break;

            let packetLength = pkt.getUint8(1) + headerLength + 1 + 2; // payload + protocol marker + header + checksum

            // MAVLink v2 may add a signature block
            if (isMavlinkV2 && (pkt.getUint8(2) & MAVLINK_IFLAG_SIGNED) > 0) {
                packetLength += MAVLINK_SIGNATURE_BLOCK_LEN;
            }

            // Check to see if we have a full packet
            if (pkt.byteLength < packetLength)
                break;

            // Slice out the packet bytes and try to parse it into a MavLink packet
            const fullPacket = new DataView(parseBuf.buffer, idx, packetLength);
            idx += packetLength;

            let msg: IMavlinkHeader;
            try
            {
                msg = this.ParseSinglePacket(fullPacket);
                if (msg != null)
                {
                    newMessages.push(msg);
                }
            }
            catch(ex)
            {
                console.log("Unable to parse packet:", ex);
                this.parseErrors++;
            }
        }

        // Anything leftover is residual that we'll keep to try to reassemble with more data when it arrives.
        if (idx < parseBuf.length) {
            this.residual = parseBuf.slice(idx);
        }

        return newMessages;
    }

    ParseSinglePacket(buf: DataView): any | undefined {

        let header: IMavlinkHeader;

        // Parse out the header
        if (buf.getUint8(0) == MAVLINK_STX) {
            header = {
                is_mavlink_v2: true,
                payload_length: buf.getUint8(1),
                incompat_flags: buf.getUint8(2),
                compat_flags: buf.getUint8(3),
                sequence: buf.getUint8(4),
                system_id: buf.getUint8(5),
                component_id: buf.getUint8(6),
                message_id: ((buf.getUint8(9) << 16) + (buf.getUint8(8) << 8) + buf.getUint8(7)),
            }

            if ((header.incompat_flags! & MAVLINK_IFLAG_SIGNED) > 0)
            {
                const sig_block = new DataView(buf.buffer, buf.byteLength - MAVLINK_SIGNATURE_BLOCK_LEN);
                header.signature_link_id = sig_block.getUint8(0);
                header.signature_timestamp = getUint64(new DataView(buf.buffer, 1, 6));
                header.signature = sig_block.buffer.slice(7);
            }
        } else {
            header = {
                is_mavlink_v2: false,
                payload_length: buf.getUint8(1),
                sequence: buf.getUint8(2),
                system_id: buf.getUint8(3),
                component_id: buf.getUint8(4),
                message_id: buf.getUint8(5),
            }
        }

        const headerLen = header.is_mavlink_v2 ? MAVLINK2_HEADER_LEN : MAVLINK1_HEADER_LEN;
        const crcIdx = headerLen + header.payload_length + 1;

        //console.log("Buf:", toHex(buf));
        //console.log("headerLen", headerLen, "header.payload_length", header.payload_length, "crcIdx", crcIdx);

        const msgCrc = buf.getUint16(crcIdx, true);
        const pktDesc = MAVLINK_MESSAGE_DESCRIPTORS.get(header.message_id);
        if (pktDesc == null) {
            console.warn("Unknown MAVLink message id", header.message_id);
            return { header };
        }

        // Calculate the checksum over the header and payload bytes
        const compCrc = calculate_crc(buf, 1, headerLen + header.payload_length, pktDesc.crc_extra);
        if (msgCrc !== compCrc) {
            console.log(compCrc, msgCrc);
            console.warn("MAVLink decode CRC error for packet type", pktDesc.name);
            return;
        }

        let payloadView;
        if (header.payload_length < pktDesc.len) {
            // Handle zero byte payload truncation
            // see: https://mavlink.io/en/guide/serialization.html#payload_truncation
            const payloadBuf = new Uint8Array(pktDesc.len);
            const source = new Uint8Array(buf.buffer.slice(headerLen+1, headerLen+1+header.payload_length));
            payloadBuf.set(source);
            payloadView = new DataView(payloadBuf.buffer, 0, pktDesc.len);
        } else {
            payloadView = new DataView(buf.buffer, headerLen+1, pktDesc.len);
        }

        let pkt = unpack(payloadView, pktDesc.format, pktDesc.fields);
        pkt.header = header;
        return pkt;
    }
}
