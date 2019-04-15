#!/usr/bin/env python
'''
parse a MAVLink protocol XML file and generate a C# implementation

Copyright Michael Oborne 2018
Released under GNU GPL version 3 or later
'''

import re
from . import mavparse, mavtemplate

t = mavtemplate.MAVTemplate()

enumtypes = {}


def generate_message_header(f, xml):
    if xml.little_endian:
        xml.mavlink_endian = "MAVLINK_LITTLE_ENDIAN"
    else:
        xml.mavlink_endian = "MAVLINK_BIG_ENDIAN"

    if xml.crc_extra:
        xml.crc_extra_define = "1"
    else:
        xml.crc_extra_define = "0"

    if xml.command_24bit:
        xml.command_24bit_define = "1"
    else:
        xml.command_24bit_define = "0"

    if xml.sort_fields:
        xml.aligned_fields_define = "1"
    else:
        xml.aligned_fields_define = "0"

    xml.message_names_enum = ''

    # and message CRCs array
    xml.message_infos_array = ''
    if xml.command_24bit:
        # we sort with primary key msgid, secondary key dialect
        for msgid in sorted(xml.message_names.keys()):
            name = xml.message_names[msgid]
            xml.message_infos_array += '		new message_info(%u, "%s", %u, %u, %u, typeof(mavlink_%s_t), Deserialize_%s, Serialize_%s),\n' % (
            msgid,
            name,
            xml.message_crcs[msgid],
            xml.message_min_lengths[msgid],
            xml.message_lengths[msgid],
            name.lower(),
            name.lower(),
            name.lower())
            xml.message_names_enum += '         %s = %u,\n' % (name, msgid)
    else:
        for msgid in range(256):
            crc = xml.message_crcs.get(msgid, None)
            name = xml.message_names.get(msgid, None)
            length = xml.message_lengths.get(msgid, None)
            if name is not None:
                xml.message_infos_array += '		new message_info(%u, "%s", %u, %u, %u, typeof mavlink_%s_t), Deserialize_%s, Serialize_%s),\n' % (
                    msgid,
                    name,
                    crc,
                    length,
                    length,
                    name.lower(),
                    name.lower(),
                    name.lower())
                xml.message_names_enum += '         %s = %u,\n' % (name, msgid)

    # add some extra field attributes for convenience with arrays
    for m in xml.enum:
        m.description = m.description.replace("\n", " ")
        m.description = m.description.replace("\r", " ")
        for fe in m.entry:
            fe.description = fe.description.replace("\n", " ")
            fe.description = fe.description.replace("\r", " ")
            fe.name = fe.name.replace(m.name + "_", "")
            fe.name = fe.name.replace("NAV_", "")
            firstchar = re.search('^([0-9])', fe.name)
            if firstchar != None and firstchar.group():
                fe.name = '_%s' % fe.name

    t.write(f, '''
using System;
using System.IO;
using System.Text;

public partial class MAVLink
{
    public const string MAVLINK_BUILD_DATE = "${parse_time}";
    public const string MAVLINK_WIRE_PROTOCOL_VERSION = "${wire_protocol_version}";
    public const int MAVLINK_MAX_PAYLOAD_LEN = ${largest_payload};

    public const byte MAVLINK_VERSION = ${version};

    public const byte MAVLINK_IFLAG_SIGNED = 0x01;
    public const byte MAVLINK_IFLAG_MASK   = 0x01;

    public const byte MAVLINK_CORE_HEADER_LEN = 9;  ///< Length of core header (of the comm. layer)
    public const byte MAVLINK_CORE_HEADER_MAVLINK1_LEN = 5; ///< Length of MAVLink1 core header (of the comm. layer)
    public const byte MAVLINK_NUM_HEADER_BYTES = (MAVLINK_CORE_HEADER_LEN + 1); ///< Length of all header bytes, including core and stx
    public const byte MAVLINK_NUM_CHECKSUM_BYTES = 2;
    public const byte MAVLINK_NUM_NON_PAYLOAD_BYTES = (MAVLINK_NUM_HEADER_BYTES + MAVLINK_NUM_CHECKSUM_BYTES);

    public const int MAVLINK_MAX_PACKET_LEN = (MAVLINK_MAX_PAYLOAD_LEN + MAVLINK_NUM_NON_PAYLOAD_BYTES + MAVLINK_SIGNATURE_BLOCK_LEN); ///< Maximum packet length
    public const byte MAVLINK_SIGNATURE_BLOCK_LEN = 13;

    public const int MAVLINK_LITTLE_ENDIAN = 1;
    public const int MAVLINK_BIG_ENDIAN = 0;

    public const byte MAVLINK_STX = ${protocol_marker};

    public const byte MAVLINK_STX_MAVLINK1 = 0xFE;

    public const byte MAVLINK_ENDIAN = ${mavlink_endian};

    public const bool MAVLINK_ALIGNED_FIELDS = (${aligned_fields_define} == 1);

    public const byte MAVLINK_CRC_EXTRA = ${crc_extra_define};
    
    public const byte MAVLINK_COMMAND_24BIT = ${command_24bit_define};
        
    public const bool MAVLINK_NEED_BYTE_SWAP = (MAVLINK_ENDIAN == MAVLINK_LITTLE_ENDIAN);
    
    public delegate object DeserializeDelegate(ReadOnlySpan<byte> buf);
    public delegate byte[] SerializeDelegate(object v);
    
    static byte[] EncodeString(String s, int fullLength)
    {
        byte[] fullBuf = new byte[fullLength];
        byte[] strBuf = ASCIIEncoding.Default.GetBytes(s);
        Buffer.BlockCopy(strBuf, 0, fullBuf, 0, Math.Min(fullBuf.Length, strBuf.Length));
        return fullBuf;
    }
    
    // msgid, name, crc, length, type
    public static readonly message_info[] MAVLINK_MESSAGE_INFOS = new message_info[] {
${message_infos_array}
    };

    public struct message_info
    {
        public uint msgid { get; internal set; }
        public string name { get; internal set; }
        public byte crc { get; internal set; }
        public int minlength { get; internal set; }
        public int length { get; internal set; }
        public Type type { get; internal set; }
        public DeserializeDelegate deserializer { get; internal set; }
        public SerializeDelegate serializer { get; internal set; }
        
        public message_info(uint msgid, string name, byte crc, int minlength, int length, Type type, DeserializeDelegate deserializer, SerializeDelegate serializer)
        {
            this.msgid = msgid;
            this.name = name;
            this.crc = crc;
            this.minlength = minlength;
            this.length = length;
            this.type = type;
            this.deserializer = deserializer;
            this.serializer = serializer;
        }

        public override string ToString()
        {
            return String.Format("{0} - {1}",name,msgid);
        }
    }   

    public enum MAVLINK_MSG_ID 
    {
${message_names_enum}
    }
''', xml)


def is_string_field(field):
    """ Determine whether or not this field should be treated as a String """
    return field.name == "param_id" or field.name == "text" or field.name == "url"


def build_message_meta(messages):
    """ Generate the metadata we're using for each message and field """

    for m in messages:
        m.description = m.description.replace("\n", "    \n///")
        m.description = m.description.replace("\r", "")
        m.description = m.description.replace("\"", "'")

        for f in m.fields:

            # Check C# Keyword collisions
            if f.name == 'fixed':
                f.name = 'fixed_value'

            # Format the description text
            f.description = f.description.replace("\n", "    \n///")
            f.description = f.description.replace("\r", "")
            f.description = f.description.replace("\"", "'")

            # Default field metadata
            f.serialize = 'b.Write(v.{})'.format(f.name)
            f.deserialize = ''
            f.enum_cast = ''

            if is_string_field(f):
                # Strings
                f.type = 'string'
                f.deserialize = 'ASCIIEncoding.Default.GetString(spanBuf.Slice({}, {}).ToArray()).TrimEnd((Char)0)'.format(f.wire_offset, f.wire_length)
                f.serialize = 'b.Write(EncodeString(v.{}, {}))'.format(f.name, f.wire_length)

            elif f.array_length == 0:
                # Single value fields

                if f.type == 'char':
                    f.type = "byte"
                    f.deserialize = 'buf[{}]'.format(f.wire_offset)

                elif f.type == 'uint8_t':
                    f.type = "byte"
                    f.deserialize = 'buf[{}]'.format(f.wire_offset)

                elif f.type == 'int8_t':
                    f.type = "sbyte"
                    f.deserialize = '(sbyte) buf[{}]'.format(f.wire_offset)

                elif f.type == 'int16_t':
                    f.type = "short"
                    f.deserialize = 'BitConverter.ToInt16(buf, {})'.format(f.wire_offset)

                elif f.type == 'uint16_t':
                    f.type = "ushort"
                    f.deserialize = 'BitConverter.ToUInt16(buf, {})'.format(f.wire_offset)

                elif f.type == 'uint32_t':
                    f.type = "uint"
                    f.deserialize = 'BitConverter.ToUInt32(buf, {})'.format(f.wire_offset)

                elif f.type == 'int32_t':
                    f.type = "int"
                    f.deserialize = 'BitConverter.ToInt32(buf, {})'.format(f.wire_offset)

                elif f.type == 'uint64_t':
                    f.type = "ulong"
                    f.deserialize = 'BitConverter.ToUInt64(buf, {})'.format(f.wire_offset)

                elif f.type == 'int64_t':
                    f.type = "long"
                    f.deserialize = 'BitConverter.ToInt64(buf, {})'.format(f.wire_offset)

                elif f.type == 'float':
                    f.type = "float"
                    f.deserialize = 'BitConverter.ToSingle(buf, {})'.format(f.wire_offset)

                elif f.type == 'double':
                    f.type = "double"
                    f.deserialize = 'BitConverter.ToDouble(buf, {})'.format(f.wire_offset)

                else:
                    raise Exception("Unhandled data type: " + f.type)

            elif f.array_length != 0:

                # Arrays
                f.serialize = 'b.Write(Array.ConvertAll(v.{}, Convert.ToByte))'.format(f.name)

                if f.type == 'char':
                    f.type = "byte[]"
                    f.deserialize = 'spanBuf.Slice({}, {}).ToArray()'.format(f.wire_offset, f.wire_length)

                elif f.type == 'uint8_t':
                    f.type = "byte[]"
                    f.deserialize = 'spanBuf.Slice({}, {}).ToArray()'.format(f.wire_offset, f.wire_length)

                elif f.type == 'int8_t':
                    f.type = "sbyte[]"
                    f.deserialize = f.deserializer = 'Array.ConvertAll(spanBuf.Slice({}, {}).ToArray(), Convert.ToSByte)'.format(f.wire_offset, f.wire_length)

                elif f.type == 'int16_t':
                    f.type = "Int16[]"
                    f.deserialize = 'Array.ConvertAll(spanBuf.Slice({}, {}).ToArray(), Convert.ToInt16)'.format(f.wire_offset, f.wire_length)

                elif f.type == 'uint16_t':
                    f.type = "UInt16[]"
                    f.deserialize = 'Array.ConvertAll(spanBuf.Slice({}, {}).ToArray(), Convert.ToUInt16)'.format(f.wire_offset, f.wire_length)

                elif f.type == 'int32_t':
                    f.type = "Int32[]"
                    f.deserialize = 'Array.ConvertAll(spanBuf.Slice({}, {}).ToArray(), Convert.ToInt32)'.format(f.wire_offset, f.wire_length)

                elif f.type == 'uint32_t':
                    f.type = "UInt32[]"
                    f.deserialize = 'Array.ConvertAll(spanBuf.Slice({}, {}).ToArray(), Convert.ToUInt32)'.format(f.wire_offset, f.wire_length)

                elif f.type == 'long':
                    f.type = "Int64[]"
                    f.deserialize = 'Array.ConvertAll(spanBuf.Slice({}, {}).ToArray(), Convert.ToInt64)'.format(f.wire_offset, f.wire_length)

                elif f.type == 'ulong':
                    f.type = "UInt64[]"
                    f.deserialize = 'Array.ConvertAll(spanBuf.Slice({}, {}).ToArray(), Convert.ToUInt64)'.format(f.wire_offset, f.wire_length)

                elif f.type == 'float':
                    f.type = "float[]"
                    f.deserialize = 'Array.ConvertAll(spanBuf.Slice({}, {}).ToArray(), Convert.ToSingle)'.format(f.wire_offset, f.wire_length)

                elif f.type == 'double':
                    f.type = "double[]"
                    f.deserialize = 'Array.ConvertAll(spanBuf.Slice({}, {}).ToArray(), Convert.ToDouble)'.format(f.wire_offset, f.wire_length)

                else:
                    raise Exception("Unhandled array data type: " + f.type)

            # Enums
            if f.enum != "":
                enumtypes[f.enum] = f.type
                f.enum_cast = '({})'.format(f.enum)
                f.serialize = 'b.Write(({}) v.{})'.format(f.type, f.name)
                f.type = f.enum


def generate_message_enums(f, xml):
    print "generate_message_enums: " + xml.filename
    # add some extra field attributes for convenience with arrays
    for m in xml.enum:
        m.description = m.description.replace("\n", "    \n///")
        m.description = m.description.replace("\r", " ")
        m.description = m.description.replace("\"", "'")
        m.enumtype = enumtypes.get(m.name, "int /*default*/")

        # Remove the "ENUM_END" enum tags
        m.entry = list(filter(lambda v: not v.name.endswith('ENUM_END'), m.entry))

        for fe in m.entry:
            fe.description = fe.description.replace("\n", " ")
            fe.description = fe.description.replace("\r", " ")
            fe.description = fe.description.replace("\"", "'")
            fe.name = fe.name.replace(m.name + "_", "")
            firstchar = re.search('^([0-9])', fe.name)
            if firstchar != None and firstchar.group():
                fe.name = '_%s' % fe.name

    t.write(f, '''
    ${{enum:
    ///<summary> ${description} </summary>
    public enum ${name}: ${enumtype}
    {
    ${{entry:    ///<summary> ${description} |${{param:${description}| }} </summary>
        ${name}=${value},
    }}
    };
    }}
''', xml)


def generate_message(f, m):
    t.write(f, '''

    /// <summary> ${description} </summary>
    public class mavlink_${name_lower}_t
    {
    ${{ordered_fields:    /// <summary>${description} ${enum} ${units} ${display}</summary>
        public ${type} ${name};
    }}
    };

''', m)


def generate_deserializer(f, m):
    t.write(f, '''
        
    public static mavlink_${name_lower}_t Deserialize_${name_lower}(ReadOnlySpan<byte> spanBuf) 
    {
        byte[] buf = spanBuf.ToArray();
        var v = new mavlink_${name_lower}_t();
        ${{ordered_fields: 
        v.${name} = ${enum_cast} ${deserialize}; }}
        return v;
    }

''', m)


def generate_serializer(f, m):
    t.write(f, '''

    public static byte[] Serialize_${name_lower}(object o) 
    {   
        var v = (mavlink_${name_lower}_t) o;
        using (MemoryStream stream = new MemoryStream())
        {
            using (BinaryWriter b = new BinaryWriter(stream))
            {
                ${{ordered_fields: 
                ${serialize}; }}
            }
            stream.Flush();
            return stream.GetBuffer();
        }
    }

''', m)

def generate(basename, xml_list):
    """ Implement the mavlink generate function to output C# """

    f = open(basename + ".cs", mode='w')

    generate_message_header(f, xml_list[0])

    for xml in xml_list:
        build_message_meta(xml.message)

    for xml in xml_list:
        generate_message_enums(f, xml)

    for xml in xml_list:
        for m in xml.message:
            generate_message(f, m)
            generate_serializer(f, m)
            generate_deserializer(f, m)

    t.write(f, '''}''', xml)
    f.close()
