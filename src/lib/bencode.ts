type BencodeValue =
    | number
    | string
    | Buffer
    | Array<BencodeValue>
    | { [key: string]: BencodeValue };

function isBuffer(value: unknown): value is Buffer {
    return Buffer.isBuffer(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !isBuffer(value);
}

export function bencodeEncode(value: BencodeValue): Buffer {
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || !Number.isInteger(value)) {
            throw new Error('bencode: only finite integers are supported');
        }
        return Buffer.from(`i${value}e`, 'utf8');
    }

    if (typeof value === 'string') {
        const data = Buffer.from(value, 'utf8');
        return Buffer.concat([Buffer.from(String(data.length) + ':', 'utf8'), data]);
    }

    if (isBuffer(value)) {
        return Buffer.concat([Buffer.from(String(value.length) + ':', 'utf8'), value]);
    }

    if (Array.isArray(value)) {
        const parts: Buffer[] = [Buffer.from('l', 'utf8')];
        for (const item of value) {
            parts.push(bencodeEncode(item));
        }
        parts.push(Buffer.from('e', 'utf8'));
        return Buffer.concat(parts);
    }

    if (isObject(value)) {
        const parts: Buffer[] = [Buffer.from('d', 'utf8')];
        const keys = Object.keys(value).sort();
        for (const key of keys) {
            const v = (value as any)[key] as BencodeValue;
            if (typeof v === 'undefined') continue;
            parts.push(bencodeEncode(key));
            parts.push(bencodeEncode(v));
        }
        parts.push(Buffer.from('e', 'utf8'));
        return Buffer.concat(parts);
    }

    throw new Error('bencode: unsupported type');
}

export function bencodeDecode(input: Buffer): BencodeValue {
    let offset = 0;

    const readByte = (): number => {
        if (offset >= input.length) throw new Error('bencode: unexpected end of input');
        return input[offset++];
    };

    const peekByte = (): number => {
        if (offset >= input.length) throw new Error('bencode: unexpected end of input');
        return input[offset];
    };

    const readNumberUntil = (terminator: number): number => {
        let sign = 1;
        if (peekByte() === 45) {
            readByte();
            sign = -1;
        }
        let num = 0;
        let sawDigit = false;
        while (true) {
            const b = readByte();
            if (b === terminator) break;
            if (b < 48 || b > 57) throw new Error('bencode: invalid number');
            sawDigit = true;
            num = num * 10 + (b - 48);
        }
        if (!sawDigit) throw new Error('bencode: empty number');
        return sign * num;
    };

    const decodeNext = (): BencodeValue => {
        const b = peekByte();

        // integer: i<digits>e
        if (b === 105) {
            readByte();
            return readNumberUntil(101);
        }

        // list: l<items>e
        if (b === 108) {
            readByte();
            const list: BencodeValue[] = [];
            while (peekByte() !== 101) {
                list.push(decodeNext());
            }
            readByte();
            return list;
        }

        // dict: d<key><value>e
        if (b === 100) {
            readByte();
            const dict: Record<string, BencodeValue> = {};
            while (peekByte() !== 101) {
                const keyVal = decodeNext();
                if (!isBuffer(keyVal)) throw new Error('bencode: dict key must be bytes');
                const key = keyVal.toString('utf8');
                dict[key] = decodeNext();
            }
            readByte();
            return dict;
        }

        // byte string: <len>:<bytes>
        if (b >= 48 && b <= 57) {
            let len = 0;
            while (true) {
                const c = readByte();
                if (c === 58) break;
                if (c < 48 || c > 57) throw new Error('bencode: invalid string length');
                len = len * 10 + (c - 48);
            }
            if (offset + len > input.length) throw new Error('bencode: string out of bounds');
            const slice = input.subarray(offset, offset + len);
            offset += len;
            return Buffer.from(slice);
        }

        throw new Error('bencode: invalid token');
    };

    const value = decodeNext();
    if (offset !== input.length) {
        // Ignore trailing whitespace? For torrent files there shouldn't be any.
        throw new Error('bencode: trailing data');
    }
    return value;
}

export function bufferToBase64Url(buf: Buffer): string {
    return buf
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

export function base64UrlToBuffer(b64url: string): Buffer {
    const padLen = (4 - (b64url.length % 4)) % 4;
    const padded = b64url + '='.repeat(padLen);
    const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64');
}

export function bufferToHexSha1(buf: Buffer): string {
    const crypto = require('node:crypto') as typeof import('node:crypto');
    return crypto.createHash('sha1').update(buf).digest('hex');
}
