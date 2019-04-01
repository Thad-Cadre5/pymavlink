using System;
using Xunit;

namespace tests
{
    public class BinaryTests
    {
        [Fact]
        public void ParseV1PacketsTest()
        {
            var data = System.IO.File.ReadAllBytes("test_packets_v1.bin");
            MavnetParser parser = new MavnetParser(Console.WriteLine);
            var messages = parser.ParseBytes(data);

            // V1 packets:
            // 0 123 212 0 0 None False HEARTBEAT {type : 1, autopilot : 2, base_mode : 3, custom_mode : 4, system_status : 5, mavlink_version : 1}
            // 1 123 212 0 0 None False HEARTBEAT { type: 1, autopilot: 2, base_mode: 3, custom_mode: 4, system_status: 5, mavlink_version: 1}

            Action<MavnetMessage> v1HeartBeatCheck = (MavnetMessage m) =>
            {
                Assert.False(m.is_mavlink_v2);
                Assert.Equal("HEARTBEAT", m.message_name);
                Assert.Equal(123, m.system_id);
                Assert.Equal(212, m.component_id);
                Assert.NotNull(m.payload);

                var payload = (MAVLink.mavlink_heartbeat_t)m.payload;

                Assert.Equal(1, payload.mavlink_version);
                Assert.Equal(MAVLink.MAV_TYPE.FIXED_WING, payload.type);
                Assert.Equal(MAVLink.MAV_AUTOPILOT.SLUGS, payload.autopilot);
                Assert.Equal((MAVLink.MAV_MODE_FLAG)3, payload.base_mode);
            };

            Assert.Collection(messages, v1HeartBeatCheck, v1HeartBeatCheck);
        }


        [Fact]
        public void ParseV2PacketsTest()
        {
            var data = System.IO.File.ReadAllBytes("test_packets_v2.bin");
            MavnetParser parser = new MavnetParser(Console.WriteLine);
            var messages = parser.ParseBytes(data);

            // V2 packets:
            // 0 123 212 0 0 None False HEARTBEAT {type : 1, autopilot : 2, base_mode : 3, custom_mode : 4, system_status : 5, mavlink_version : 1}
            // 1 123 212 0 0 None False HEARTBEAT { type: 1, autopilot: 2, base_mode: 3, custom_mode: 4, system_status: 5, mavlink_version: 1}
            // 2 123 212 0 0 None False REQUEST_DATA_STREAM { target_system: 98, target_component: 99, req_stream_id: 10, req_message_rate: 5, start_stop: 7}
            // 3 123 212 0 0 None False GPS_RAW_INT { time_usec: 1, fix_type: 2, lat: 3, lon: 4, alt: 5, eph: 6, epv: 7, vel: 8, cog: 9, satellites_visible: 10, alt_ellipsoid: 11, h_acc: 12, v_acc: 13, vel_acc: 14, hdg_acc: 15}
            // 4 123 212 0 0 None False DEVICE_OP_WRITE_REPLY { request_id: 55, result: 99}

            Assert.Collection(messages,
                m =>
                {
                    Assert.True(m.is_mavlink_v2);
                    Assert.Equal(MAVLink.MAVLINK_MSG_ID.HEARTBEAT, (MAVLink.MAVLINK_MSG_ID) m.message_id);
                                    },
                m =>
                {
                    Assert.True(m.is_mavlink_v2);
                    Assert.Equal("HEARTBEAT", m.message_name);
                },
                m =>
                {
                    Assert.True(m.is_mavlink_v2);
                    Assert.Equal("REQUEST_DATA_STREAM", m.message_name);

                    var payload = (MAVLink.mavlink_request_data_stream_t)m.payload;
                    Assert.Equal(98, payload.target_system);
                    Assert.Equal(99, payload.target_component);
                },
                m =>
                {
                    Assert.True(m.is_mavlink_v2);
                    Assert.Equal("GPS_RAW_INT", m.message_name);

                    // Check an extension field
                    var payload = (MAVLink.mavlink_gps_raw_int_t)m.payload;
                    Assert.Equal((uint)15, payload.hdg_acc);
                },
                m =>
                {
                    // High message ID packet
                    Assert.True(m.is_mavlink_v2);
                    Assert.Equal("DEVICE_OP_WRITE_REPLY", m.message_name);

                    var payload = (MAVLink.mavlink_device_op_write_reply_t)m.payload;
                    Assert.Equal((uint)55, payload.request_id);
                });
        }

        [Fact]
        public void ParsingEventTest()
        {
            var data = System.IO.File.ReadAllBytes("test_packets_v2.bin");
            MavnetParser parser = new MavnetParser(Console.WriteLine);

            int packetsRead = 0;
            parser.PacketReceived += (sender, e) =>
            {
                packetsRead++;
            };

            var messages = parser.ParseBytes(data);
            Assert.Equal(5, packetsRead);
        }

        [Fact]
        public void IncrementalParsingTest()
        {
            var data = System.IO.File.ReadAllBytes("test_packets_v2.bin");
            MavnetParser parser = new MavnetParser(Console.WriteLine);

            int packetsRead = 0;
            parser.PacketReceived += (sender, e) =>
            {
                packetsRead++;
            };

            // Parse one byte at a time
            for(int i=0; i < data.Length; i++)
            {
                parser.ParseBytes(new byte[] { data[i] });
            }

            Assert.Equal(5, packetsRead);
        }


        [Fact]
        public void SerializationTest()
        {
            var data = System.IO.File.ReadAllBytes("test_packets_v2.bin");
            MavnetParser parser = new MavnetParser(Console.WriteLine);

            // Read messages
            var messages = parser.ParseBytes(data);

            // Hook up receive event
            int packetsRead = 0;
            parser.PacketReceived += (sender, e) =>
            {
                packetsRead++;
            };


            foreach(var msg in messages)
            {
                parser.ParseBytes(msg.toBytes());
            }

            // Check that we received copies of the serialized messages
            Assert.Equal(5, packetsRead);
        }
    }
}
