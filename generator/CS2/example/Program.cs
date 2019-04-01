using System;

namespace csharp
{
    class Program
    {
        static void Main(string[] args)
        {
            const string DATA_FILE = "/Users/thadthompson/dev/uvdl/thirdparty/genwork/test_packets_v2.bin";
            const string TEST_OUT_FILE = "/Users/thadthompson/dev/uvdl/thirdparty/genwork/test_output_packets_v2.bin";

            Console.WriteLine("Starting MAVLink test");
            var data = System.IO.File.ReadAllBytes(DATA_FILE);

            // Create a parser with logging output to Console.WriteLine
            MavnetParser parser = new MavnetParser(Console.WriteLine);
            parser.PacketReceived += (sender, e) =>
            {
                Console.WriteLine("Received Packet: " + e);
            };

            var messages = parser.ParseBytes(data);
            using (var fout = System.IO.File.OpenWrite(TEST_OUT_FILE))
            {
                foreach (var msg in messages)
                {
                    // Round trip through JSON
                    string js = msg.toJson();
                    MavnetMessage jsmsg = Newtonsoft.Json.JsonConvert.DeserializeObject<MavnetMessage>(js);
                    fout.Write(jsmsg.toBytes());
                }
            }

            Console.WriteLine("Testing incremental message parsing");
            for(int i=0; i < data.Length; i++)
            {
                var messages2 = parser.ParseBytes(new byte[] { data[i] });
                if( messages2.Count > 0)
                {
                    Console.WriteLine("Parsed message at {0} bytes: {1}", i, messages2[0].toJson());
                }
            }


            //    string TEST_MESSAGE = "{\"system_id\":123,\"component_id\":212,\"message_name\":\"HEARTBEAT\",\"payload\":{\"custom_mode\":4,\"type\":1,\"autopilot\":2,\"base_mode\":3,\"system_status\":5,\"mavlink_version\":1}}";
            //    //MavnetMessage jsmsg = Newtonsoft.Json.JsonConvert.DeserializeObject<MavnetMessage>(TEST_MESSAGE);
            //    Console.WriteLine(jsmsg.toJson());
        }
    }
}
