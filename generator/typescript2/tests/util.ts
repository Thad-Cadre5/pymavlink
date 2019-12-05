export function fromHex(str: string): ArrayBuffer {
    let s = str.match(/.{1,2}/g);
    if (s == null) {
        throw new Error("Invalid hex string format");
    }

    return new Uint8Array(s.map(byte => parseInt(byte, 16))).buffer;
}
