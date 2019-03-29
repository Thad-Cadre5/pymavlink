using System;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;


/// <summary>
/// Handles conversion of JSON into a MavnetMessage.
/// </summary>
public class MavnetMessageConverter : JsonConverter
{
    public override bool CanWrite => false;
    public override bool CanRead => true;

    public override bool CanConvert(Type objectType)
    {
        return true;
    }

    public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
    {
        JObject jObj = JObject.Load(reader);

        // Validate the required fields
        var system_id = jObj.GetValue("system_id");
        var component_id = jObj.GetValue("component_id");
        var message_name = jObj.GetValue("message_name");
        var payload = jObj.GetValue("payload");

        if (system_id == null)
            throw new JsonSerializationException("system_id is a required message field");

        if (component_id == null)
            throw new JsonSerializationException("component_id is a required message field");

        if (message_name == null)
            throw new JsonSerializationException("message_name is a required message field");

        if (payload == null)
            throw new JsonSerializationException("payload is a required message field");


        MavnetMessage msg = new MavnetMessage();
        msg.system_id = system_id.Value<byte>();
        msg.component_id = component_id.Value<byte>();
        msg.message_name = message_name.Value<string>();

        // Lookup the Mavlink info object by name
        var messageInfo = MAVLink.MAVLINK_MESSAGE_INFOS.FirstOrDefault(m => m.name.Equals(msg.message_name));
        if (messageInfo.type == null)
            throw new JsonSerializationException("unrecognized message_name: " + msg.message_name);

        // Deserialize the payload
        msg.message_id = messageInfo.msgid;
        msg.payload = Activator.CreateInstance(messageInfo.type);
        serializer.Populate(payload.CreateReader(), msg.payload); 

        return msg;
    }

    public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
    {
        throw new InvalidOperationException("Use default serialization.");
    }
}

