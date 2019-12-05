//import JSBI from "jsbi";

const LITTLE_ENDIAN = true;

const BIGINT_32 = JSBI.BigInt(32);
const BIGINT_LOW_MASK = JSBI.BigInt("0xFFFFFFFF");
const BIGINT_64_BASE = JSBI.BigInt("0x010000000000000000");

export function getInt64(buf: DataView, byteOffset: number = 0): JSBI {
    let i = getUint64(buf, byteOffset);
    return buf.getInt8(byteOffset + 7) < 0 ? JSBI.subtract(i, BIGINT_64_BASE) : i;
}

export function getUint64(buf: DataView, byteOffset: number = 0): JSBI {
    return JSBI.add(
        JSBI.BigInt(buf.getUint32(byteOffset, LITTLE_ENDIAN)),
        JSBI.leftShift(JSBI.BigInt(buf.getUint32(byteOffset+4, LITTLE_ENDIAN)), BIGINT_32)
    );
}

export function setInt64(value: JSBI, buf: DataView, byteOffset: number = 0) {
    const low = JSBI.toNumber(JSBI.bitwiseAnd(BIGINT_LOW_MASK, value));
    const high = JSBI.toNumber(JSBI.signedRightShift(value, BIGINT_32));
    buf.setUint32(byteOffset, low, LITTLE_ENDIAN);
    buf.setInt32(byteOffset+4, high, LITTLE_ENDIAN);
}

export function setUint64(value: JSBI, buf: DataView, byteOffset: number = 0) {
    const low = JSBI.toNumber(JSBI.bitwiseAnd(BIGINT_LOW_MASK, value));
    const high = JSBI.toNumber(JSBI.signedRightShift(value, BIGINT_32));
    buf.setUint32(byteOffset, low, LITTLE_ENDIAN);
    buf.setUint32(byteOffset+4, high, LITTLE_ENDIAN);
}

function deserializeAsciiString(buf: DataView, byteOffset: number, count: number) : string {
    let str = "";
    for(let i=0; i < count; i++) {
        const ival = buf.getUint8(byteOffset + i);

        // Strings may be null terminated - stop decoding at the first null
        if (ival == 0) {
            break;
        }
        str += String.fromCharCode(ival);
    }

    return str;
}

function serializeAsciiString(value: string, buf: DataView, byteOffset: number, count: number) {
    for(let i=0; i < count && i < value.length; i++) {
        let ch = value.charCodeAt(i);
        buf.setUint8(byteOffset, ch & 0xFF);
        byteOffset++;
    }
}

const CONVERTERS = new Map([
    ['f', {size: 4, func: (buf: DataView, off: number) => buf.getFloat32(off, LITTLE_ENDIAN), write: (v: any, buf: DataView, off: number) => buf.setFloat32(off, v, LITTLE_ENDIAN) }],
    ['d', {size: 8, func: (buf: DataView, off: number) => buf.getFloat64(off, LITTLE_ENDIAN), write: (v: any, buf: DataView, off: number) => buf.setFloat64(off, v, LITTLE_ENDIAN)}],
    ['c', {size: 1, func: (buf: DataView, off: number) => String.fromCharCode(buf.getUint8(off)), write: (v: any, buf: DataView, off: number) => buf.setUint8(off, v)}],
    ['b', {size: 1, func: (buf: DataView, off: number) => buf.getInt8(off), write: (v: any, buf: DataView, off: number) => buf.setInt8(off, v)}],
    ['B', {size: 1, func: (buf: DataView, off: number) => buf.getUint8(off), write: (v: any, buf: DataView, off: number) => buf.setUint8(off, v)}],
    ['h', {size: 2, func: (buf: DataView, off: number) => buf.getInt16(off, LITTLE_ENDIAN), write: (v: any, buf: DataView, off: number) => buf.setInt16(off, v, LITTLE_ENDIAN)}],
    ['H', {size: 2, func: (buf: DataView, off: number) => buf.getUint16(off, LITTLE_ENDIAN), write: (v: any, buf: DataView, off: number) => buf.setUint16(off, v, LITTLE_ENDIAN)}],
    ['i', {size: 4, func: (buf: DataView, off: number) => buf.getInt32(off, LITTLE_ENDIAN), write: (v: any, buf: DataView, off: number) => buf.setInt32(off, v, LITTLE_ENDIAN)}],
    ['I', {size: 4, func: (buf: DataView, off: number) => buf.getUint32(off, LITTLE_ENDIAN), write: (v: any, buf: DataView, off: number) => buf.setUint32(off, v, LITTLE_ENDIAN)}],
    ['q', {size: 8, func: (buf: DataView, off: number) => getInt64(buf, off), write: (v: any, buf: DataView, off: number) => setInt64(v, buf, off)}],
    ['Q', {size: 8, func: (buf: DataView, off: number) => getUint64(buf, off), write: (v: any, buf: DataView, off: number) => setUint64(v, buf, off)}],
]);

export class TypeFormat {
    code: string;
    count: number;
    constructor(code: string, count: number) {
        this.code = code;
        this.count = count;
    }
}

export function parseWireTypeString(typeString: string): TypeFormat [] {
    const fmts: TypeFormat [] = [];
    let typeIdx = 0;

    while(typeIdx < typeString.length) {
        let countBuf = "";
        while(!isNaN(typeString[typeIdx] as any)) {
            countBuf += typeString[typeIdx];
            typeIdx++;

            if (typeIdx >= typeString.length) {
                throw new RangeError("invalid typeString");
            }
        }

        let count = 1;
        if (countBuf.length > 0) {
            count = parseInt(countBuf);
        }
        fmts.push(new TypeFormat(typeString[typeIdx], count));
        typeIdx++;
    }

    return fmts;
}

export function unpack(buf: DataView, typeString: string, fields: string[]): any {

    let o = {} as any
    let bufIdx = 0;
    let wireTypes = parseWireTypeString(typeString);

    if (wireTypes.length !== fields.length) {
        throw new Error("typeString/fields mismatch");
    }

    for(let i=0; i < wireTypes.length; i++) {
        const type = wireTypes[i];
        const field = fields[i];

        const converter = CONVERTERS.get(type.code);
        if (converter == null) {
            throw new Error("Invalid format type code");
        }

        if (type.count > 1) {
            if (type.code === 'c') {
                // String
                o[field] = deserializeAsciiString(buf, bufIdx, type.count);
                bufIdx += type.count;
            } else if (type.code === 'B') {
                // Byte array
                o[field] = buf.buffer.slice(bufIdx, bufIdx+type.count),
                bufIdx += type.count;
            } else {
                // All other arrays
                o[field] = [];
                for(let i = 0; i < type.count; i++) {
                    o[field].push(converter.func(buf, bufIdx));
                    bufIdx += converter.size;
                }
            }
        } else {
            o[field] = converter.func(buf, bufIdx);
            bufIdx += converter.size;
        }
    }

    return o;
}


export function pack(o: any, buf: DataView, byteOffset: number, typeString: string, fields: string[]) {

    let wireTypes = parseWireTypeString(typeString);

    if (wireTypes.length !== fields.length) {
        throw new Error("typeString/fields mismatch");
    }

    for(let i=0; i < wireTypes.length; i++) {
        const type = wireTypes[i];
        const field = fields[i];
        const conv = CONVERTERS.get(type.code);

        if (conv == null) {
            throw new Error("Invalid format type code");
        }

        let value = o[field];
        if (value == null) {
            byteOffset += type.count * conv.size;
            continue;
        }

        if (type.count > 1) {
            if (type.code === 'c') {
                // String
                serializeAsciiString(value, buf, byteOffset, type.count);
                byteOffset += type.count;
            } else {
                // All other arrays
                for (let i=0; i < type.count; i++) {
                    let v = i < value.length ? value[i] : 0;
                    conv.write(v, buf, byteOffset);
                    byteOffset += conv.size;
                }
            }
        } else {
            conv.write(value, buf, byteOffset);
            byteOffset += conv.size;
        }
    }
}
