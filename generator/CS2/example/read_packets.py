import sys
import python.mavlink_v2 as mavlink

if len(sys.argv) < 2:
    print("need file to read")
    exit(-1)

FILENAME = sys.argv[-1]

print("Reading packets for MAVLink version " + mavlink.WIRE_PROTOCOL_VERSION)

buf = open(FILENAME, "rb").read()
mav = mavlink.MAVLink(None)
packets = mav.parse_buffer(buf)

for pkt in packets:
    line = [
        pkt.get_seq(),
        pkt.get_srcSystem(),
        pkt.get_srcComponent(),
        pkt.get_header().compat_flags,
        pkt.get_header().incompat_flags,
        pkt.get_link_id(),
        pkt.get_signed(),
        pkt
    ]
    print(' '.join([str(v) for v in line]))