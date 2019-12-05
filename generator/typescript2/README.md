This is a Typescript MAVLink codec.

# Features
* MAVLink v2 support
* Strict TypeScript compliance
* Browser compatible

# Notes
Packet signing is not implemented, but should be fairly easy to add if needed.

64-bit integer support is implemented with the JSBI library (https://github.com/GoogleChromeLabs/jsbi). This provides a
polyfill for environments (e.g. browsers) that don't yet implement BigInt support. You'll need to include this in your
build to use this codec.


