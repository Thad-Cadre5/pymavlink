using System;
using System.Collections.Generic;

public class MavnetParser
{
    public long crcErrors;
    public long unknownMessageTypes;
    public long trashBytes;
    public long packetsParsed;

    public delegate void PacketReceivedEventHandler(object sender, MavnetMessage e);

    /// <summary>
    /// Event raised when a message is decoded successfully
    /// </summary>
    public event PacketReceivedEventHandler PacketReceived;

    private byte[] _residual;
    private Dictionary<uint, MAVLink.message_info> _messageInfoTable;
    private Action<string> _errorLogger;

    public MavnetParser(Action<string> errorLogger = null)
    {
        _errorLogger = errorLogger;

        // Organize message info structures for fast lookup by message ID.
        _messageInfoTable = new Dictionary<uint, MAVLink.message_info>();
        foreach (var info in MAVLink.MAVLINK_MESSAGE_INFOS)
        {
            _messageInfoTable.Add(info.msgid, info);
        }
    }

    /// <summary>
    /// Add an array of bytes to the parser. Any newly parsed packets are returned.
    /// </summary>
    public IList<MavnetMessage> ParseBytes(byte []buf)
    {
        var newMessages = new List<MavnetMessage>();

        // Combine any previous data we were holding with the new buffer
        byte[] parseBuf;
        if (_residual == null)
        {
            parseBuf = buf;
        }
        else
        {
            parseBuf = new byte[_residual.Length + buf.Length];
            Buffer.BlockCopy(_residual, 0, parseBuf, 0, _residual.Length);
            Buffer.BlockCopy(buf, 0, parseBuf, _residual.Length, buf.Length);
        }

        _residual = null;

        // Start parsing
        int idx = 0;

        while(idx < parseBuf.Length)
        {
            // Search for a packet header
            for (; idx < parseBuf.Length && parseBuf[idx] != MAVLink.MAVLINK_STX && parseBuf[idx] != MAVLink.MAVLINK_STX_MAVLINK1; idx++)
            {
                trashBytes++;
            }

            // Check for data left
            if (idx == parseBuf.Length)
                break;

            // Create a slice in the parse buffer for our potential packet
            Span<byte> pkt = new Span<byte>(parseBuf, idx, parseBuf.Length - idx);

            bool isMavlinkV2 = pkt[0] == MAVLink.MAVLINK_STX;

            // Check to see if we have the header
            int headerlength = isMavlinkV2 ? MAVLink.MAVLINK_CORE_HEADER_LEN : MAVLink.MAVLINK_CORE_HEADER_MAVLINK1_LEN;
            if (pkt.Length < headerlength)
                break;

            // packet length
            int packetLength = pkt[1] + headerlength + 1 + 2; // payload + protocol marker + header + checksum

            // MAVLink v2 may to add a signature block
            if (isMavlinkV2 && (pkt[2] & MAVLink.MAVLINK_IFLAG_SIGNED) > 0)
            { 
                packetLength += MAVLink.MAVLINK_SIGNATURE_BLOCK_LEN;
            }

            // Check to see if we have a full packet
            if (pkt.Length < packetLength)
                break;

            // Slice out the packet bytes and try to parse it into a MavLink packet
            idx += packetLength;
            Span<byte> fullPacket = pkt.Slice(0, packetLength);
            MavnetMessage msg = ParseSinglePacket(fullPacket);
            if (msg != null)
            {
                newMessages.Add(msg);

                // Raise event when packet is received.
                PacketReceived?.Invoke(this, msg);
            }
        }

        // Anything leftover is residual that we'll keep to try to reassmble with more data when it arrives.
        if (idx < parseBuf.Length)
        {
            _residual = new byte[parseBuf.Length - idx];
            Buffer.BlockCopy(parseBuf, idx, _residual, 0, parseBuf.Length - idx);
        }

        return newMessages;
    }

    private void log(string message) 
    {
        if (_errorLogger == null)
            return;
        _errorLogger(message);
    }


    // Parse a single Mavnet message from a slice of a byte array
    private MavnetMessage ParseSinglePacket(Span<byte> pkt)
    {
        MavnetMessage msg = new MavnetMessage();

        // Parse out the header
        if (pkt[0] == MAVLink.MAVLINK_STX)
        {
            msg.is_mavlink_v2 = true;
            msg.payload_length = pkt[1];
            msg.incompat_flags = pkt[2];
            msg.compat_flags = pkt[3];
            msg.sequence = pkt[4];
            msg.system_id = pkt[5];
            msg.component_id = pkt[6];
            msg.message_id = (uint)((pkt[9] << 16) + (pkt[8] << 8) + pkt[7]);

            if ((msg.incompat_flags & MAVLink.MAVLINK_IFLAG_SIGNED) > 0)
            {
                Span<byte> sig_block = pkt.Slice(pkt.Length - MAVLink.MAVLINK_SIGNATURE_BLOCK_LEN);
                msg.signature_link_id = sig_block[0];
                msg.signature_timestamp = BitConverter.ToUInt64(sig_block.Slice(1, 6));
                msg.signature = sig_block.Slice(7).ToArray();
            }
        }
        else
        {
            msg.is_mavlink_v2 = false;
            msg.payload_length = pkt[1];
            msg.sequence = pkt[2];
            msg.system_id = pkt[3];
            msg.component_id = pkt[4];
            msg.message_id = pkt[5];
        }

        // Lookup the message type info.
        MAVLink.message_info messageInfo;
        if (!_messageInfoTable.TryGetValue(msg.message_id, out messageInfo)) 
        {
            log("Unknown MAVLink message ID: " + msg.message_id);
            unknownMessageTypes++;
            return null;
        }

        msg.message_name = messageInfo.name;

        // Check the CRC
        var headerLen = msg.is_mavlink_v2 ? MAVLink.MAVLINK_CORE_HEADER_LEN : MAVLink.MAVLINK_CORE_HEADER_MAVLINK1_LEN;

        var crc1 = headerLen + msg.payload_length + 1;
        var crc2 = crc1 + 1;
        ushort crc16 = (ushort)((pkt[crc2] << 8) + pkt[crc1]);

        ushort calcCrc = MAVLink.MavlinkCRC.crc_calculate(pkt.ToArray(), pkt.Length - 2);
        calcCrc = MAVLink.MavlinkCRC.crc_accumulate(messageInfo.crc, calcCrc);

        if (crc16 != calcCrc)
        {
            log(string.Format("Bad message CRC for {0} message: expected: {1}, found: {2} ", msg.message_name, calcCrc, crc16));
            crcErrors++;
            return null;
        }

        // Deserialize the payload
        try
        {
            object payload = Activator.CreateInstance(messageInfo.type);
            if (msg.is_mavlink_v2)
            {
                MavlinkUtil.ByteArrayToStructure(pkt.ToArray(), ref payload, MAVLink.MAVLINK_NUM_HEADER_BYTES, msg.payload_length);
            }
            else
            {
                MavlinkUtil.ByteArrayToStructure(pkt.ToArray(), ref payload, 6, msg.payload_length);
            }

            msg.payload = payload;
        }
        catch (Exception ex)
        {
            log(ex.ToString());
            return null;
        }

        return msg;
    }
}
