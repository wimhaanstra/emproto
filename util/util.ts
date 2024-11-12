import { EmEvseErrorState } from "./types.ts";

/**
 * Encode a password to a base64 string with some slight obfuscation.
 * To be used in conjunction with decodePassword.
 * @param password Password to encode as an ASCII string.
 * @returns Encoded password as a base64 string.
 */
export function encodePassword(password?: string): string|undefined {
    if (password === undefined) return undefined;
    const inputBuf = Buffer.from(password, "ascii");
    const outputBuf = Buffer.allocUnsafe(inputBuf.length)
    for (let i = 0; i < inputBuf.length; i++) {
        outputBuf.writeUInt8(inputBuf.readUInt8(i) ^ 0xff, i);
    }
    return outputBuf.toString("base64");
}

/**
 * Decode a password from a base64 string with some slight obfuscation.
 * @param encodedPassword Encoded password as a base64 string.
 * @returns Decoded password as an ASCII string.
 */
export function decodePassword(encodedPassword?: string): string|undefined {
    if (encodedPassword === undefined) return undefined;
    const inputBuf = Buffer.from(encodedPassword, "base64");
    const outputBuf = Buffer.allocUnsafe(inputBuf.length)
    for (let i = 0; i < inputBuf.length; i++) {
        outputBuf.writeUInt8(inputBuf.readUInt8(i) ^ 0xff, i);
    }
    return outputBuf.toString("ascii");
}

/**
 * Update a property of an object if the new value is different from the old value,
 * and return whether the property was updated.
 * @param obj      Object whose property to change.
 * @param prop     Property (name) to change.
 * @param newValue New value of property.
 * @returns True if the property was updated, false if the new value is the same as the old value.
 */
export function update(obj: object, prop: string, newValue: any): boolean {
    if (obj[prop] === newValue) {
        return false;
    }
    obj[prop] = newValue;
    return true;
}

/**
 * Read a string from a buffer, stopping at the first null character, and stripping any trailing spaces.
 * @param buffer Buffer to read string from.
 * @param start  Byte position to start reading from.
 * @param end    Byte position to stop reading at (exclusive).
 */
export function readString(buffer: Buffer, start: number, end: number): string {
    return buffer.toString("binary", start, end).split(/\s*\x00/)[0];
}

/**
 * Convert a Date object, a number of seconds since the epoch, or a string to a Date object.
 * If the parameter is already a Date instance, returns a new Date instance with the same time.
 * @param dt Date string/number/Date to convert.
 */
export function toDate(dt: Date | number | string | undefined | null): Date {
    if (dt instanceof Date || typeof dt === 'string') {
        return new Date(dt);
    } if (typeof dt === 'number') {
        return new Date(dt * 1000);
    }
    return undefined;
}

/**
 * Promised setTimeout.
 * @param ms Milliseconds to wait.
 */
export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if two enum values are equal, where either value may be a number or a string representation of that enum type.
 * @param a The first value to compare.
 * @param b The second value to compare.
 * @param enumType The enum type to use for conversion.
 * @returns True if the values are equal, false otherwise.
 */
export function enumEquals<E extends {[key: number]: string | number}>(a: keyof E | number, b: keyof E | number, enumType: E): boolean {
    console.log('enumEquals a:' + typeof a, a, 'b:' + typeof b, b, 'enumType:', enumType);
    if (typeof a === typeof b) {
        return a === b;
    }

    if (!enumType) {
        throw new Error('enumType is required if enum values are not of the same type');
    }

    const aValue = typeof a === 'string' ? (isNaN(Number(a)) ? enumType[a as keyof E] : Number(a)) : a;
    const bValue = typeof b === 'string' ? (isNaN(Number(b)) ? enumType[b as keyof E] : Number(b)) : b;

    return aValue === bValue;
}

/**
 * Convert an enum value to a string representation.
 * @param value    Enum value to convert.
 * @param enumType Enum type to use for conversion.
 * @return String representation of the enum value, or undefined if the value is not a valid key or numeric value of the enum type.
 */
export function enumStr<E extends {[key: number]: string | number}>(value: keyof E | number | undefined, enumType: E): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value === 'string') {
        if (!Object.keys(enumType).includes(value)) {
            console.warn(`Invalid enum key ${value}`);
            return undefined;
        }
        return value;
    }
    if (typeof value === 'number') {
        // Numeric enums get a reverse mapping from numeric value to string value.
        const str = enumType[value];
        if (typeof str !== 'string') {
            console.warn(`Invalid enum value ${value}`);
            return undefined;
        }
        return str;
    }
    console.warn(`Invalid enum value type ${typeof value} for type ${enumType}; expected string | number`);
    return undefined;
}

export function parseErrorState(errorState: number): EmEvseErrorState[] {
    const states: EmEvseErrorState[] = [];
    for (let i = 0; i < 32; i++) {
        if (errorState & (1 << i)) {
            states.push(i);
        }
    }
    return states;
}

export function nowStr() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()} ${now.getHours()}:${('0' + now.getMinutes()).slice(-2)}:${('0' + now.getSeconds()).slice(-2)}`;
}

export function logInfo(msg: string) {
    process.stdout.write(`[${nowStr()}] ℹ️ ${msg}\n`);
}

export function logWarning(msg: string) {
    process.stdout.write(`[${nowStr()}] ⚠️ ${msg}\n`);
}

export function logError(msg: string) {
    process.stderr.write(`[${nowStr()}] ⚠️ ${msg}\n`);
}

export function logSuccess(msg: string) {
    process.stdout.write(`[${nowStr()}] 🆗 ${msg}\n`);
}

export function dumpDebug(msg: string) {
    process.stdout.write(`[${nowStr()}] 🐞 ${msg}\n`);
}
