using System;
using System.IO;
using System.Security.Cryptography;
using Newtonsoft.Json;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Linq;

[JsonObject(MemberSerialization.OptIn)]
[JsonConverter(typeof(MavnetMessageConverter))]
public class MavnetMessage
{
    // API fields
    [JsonProperty]
    public byte system_id { get; set; }

    [JsonProperty]
    public byte component_id { get; set; }

    [JsonProperty]
    public string message_name { get; set; }

    [JsonProperty]
    public object payload { get; set; }

    // System internal fields
    public uint message_id { get; set; }
    public bool is_mavlink_v2;
    public byte payload_length;
    public byte sequence;
    public byte incompat_flags;
    public byte compat_flags;

    // Signature fields
    public byte signature_link_id;
    public ulong signature_timestamp;
    public byte[] signature;

    public override string ToString()
    {
        return string.Format("{0}, {1}, {2}, {3}", system_id, component_id, message_name, message_id);
    }

    /// <summary>
    /// Serialize this packet to JSON.
    /// </summary>
    public string toJson()
    {
        return JsonConvert.SerializeObject(this);
    }

    /// <summary>
    /// Convenience method to generate a MAVLink v2 byte message.
    /// </summary>
    public byte[] GenerateMAVLinkPacket(MAVLink.MAVLINK_MSG_ID messageType, object indata, byte sysid = 255, byte compid = 0, int sequence = -1, byte[] signingkey = null)
    {
        message_id = (uint)messageType;
        payload = indata;
        system_id = sysid;
        component_id = compid;
        return toBytes(signingkey);
    }

    /// <summary>
    /// Convert a struct to an array of bytes, struct fields being reperesented in 
    /// little endian (LSB first)
    /// </summary>
    /// <remarks>Note - assumes little endian host order</remarks>
    /// 
    /// DEPRECATED 
    /// TODO: GET RID OF THIS GARBAGE
    private static byte[] StructureToByteArray(object obj)
    {
        int len = Marshal.SizeOf(obj);
        byte[] arr = new byte[len];
        IntPtr ptr = Marshal.AllocHGlobal(len);
        Marshal.StructureToPtr(obj, ptr, true);
        Marshal.Copy(ptr, arr, 0, len);
        Marshal.FreeHGlobal(ptr);
        return arr;
    }

    /// <summary>
    /// Serialize this message to MAVLink v2 byte message.
    /// </summary>
    public byte[] toBytes(byte []signingKey = null)
    {
        byte[] payload_bytes = StructureToByteArray(payload);

        // Truncate zero bytes at the end of the payload
        var length = payload_bytes.Length;
        while (length > 1 && payload_bytes[length - 1] == 0)
        {
            length--;
        }

        Span<byte> data = new Span<byte>(payload_bytes, 0, length);

        int extra = 0;
        if (signingKey != null)
            extra = MAVLink.MAVLINK_SIGNATURE_BLOCK_LEN;

        byte[] packet = new byte[data.Length + MAVLink.MAVLINK_NUM_NON_PAYLOAD_BYTES + extra];

        packet[0] = MAVLink.MAVLINK_STX;
        packet[1] = (byte)data.Length;
        packet[2] = 0;  //incompat  signing
        if (signingKey != null)
            packet[2] |= MAVLink.MAVLINK_IFLAG_SIGNED;

        packet[3] = 0;  //compat
        packet[4] = sequence;
        packet[5] = system_id;
        packet[6] = component_id;
        packet[7] = (byte)message_id;
        packet[8] = (byte)(message_id >> 8);
        packet[9] = (byte)(message_id >> 16);

        int i = MAVLink.MAVLINK_NUM_HEADER_BYTES;
        foreach (byte b in data)
        {
            packet[i] = b;
            i++;
        }

        ushort checksum = MAVLink.MavlinkCRC.crc_calculate(packet, data.Length + MAVLink.MAVLINK_NUM_HEADER_BYTES);
        MAVLink.message_info message_info = MAVLink.MAVLINK_MESSAGE_INFOS.FirstOrDefault(info => info.msgid == message_id);
        checksum = MAVLink.MavlinkCRC.crc_accumulate(message_info.crc, checksum);

        byte ck_a = (byte)(checksum & 0xFF); ///< High byte
        byte ck_b = (byte)(checksum >> 8);   ///< Low byte

        packet[i] = ck_a;
        i += 1;
        packet[i] = ck_b;
        i += 1;

        if (signature != null)
        {
            //https://docs.google.com/document/d/1ETle6qQRcaNWAmpG2wz0oOpFKSF_bcTmYMQvtTGI8ns/edit

            /*
            8 bits of link ID
            48 bits of timestamp
            48 bits of signature
            */

            // signature = sha256_48(secret_key + header + payload + CRC + link-ID + timestamp)
            var timebytes = BitConverter.GetBytes(signature_timestamp);

            var sig = new byte[7]; // 13 includes the outgoing hash
            sig[0] = signature_link_id;
            Array.Copy(timebytes, 0, sig, 1, 6); // timestamp


            using (SHA256 signit = SHA256.Create())
            {
                MemoryStream ms = new MemoryStream();
                ms.Write(signingKey, 0, signingKey.Length);
                ms.Write(packet, 0, i);
                ms.Write(sig, 0, sig.Length);

                var ctx = signit.ComputeHash(ms.ToArray());
                // trim to 48
                Array.Resize(ref ctx, 6);

                foreach (byte b in sig)
                {
                    packet[i] = b;
                    i++;
                }

                foreach (byte b in ctx)
                {
                    packet[i] = b;
                    i++;
                }
            }
        }

        return packet;
    }
}
