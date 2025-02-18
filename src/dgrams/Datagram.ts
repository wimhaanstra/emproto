import { Buffer } from "node:buffer";

/**
 * Base class for datagram implementations.
 * Each datagram implementation class must:
 * - Extend this class.
 * - Define the static readonly `COMMAND` property to be the protocol-level command.
 * - Be registered in the `dgrams/index.ts` file (no auto-discovery of datagram classes yet).
 * - Implement the `packPayload` method to pack the payload (datagram fields) into a byte buffer for outgoing datagrams
 *   to be sent to the EVSE. For incoming datagrams (commands) that are only sent from EVSE to manager, this method can
 *   be a no-op, simply returning an empty buffer.
 * - Implement the `unpackPayload` method to unpack the payload from an incoming byte buffer into the datagram fields,
 *   and normalizing the values as needed. For datagrams (commands) that are only sent from manager to EVSE, this method
 *   can be no-op/empty.
 */
export default abstract class Datagram {

    /**
     * Implementation datagram classes must define a static `COMMAND` property.
     * They must also register themselves in dgrams/index.ts.
     */
    public static readonly COMMAND = 0 as number;


    public static readonly PACKET_HEADER = 0x0601;
    public static readonly PACKET_TAIL = 0x0f02;

    private _keyType: number = 0x00;

    private _serial?: string;
    private _password?: string;

    public getCommand(): number {
        for (let prototype = Object.getPrototypeOf(this); prototype !== Object.prototype && prototype !== Datagram.prototype; prototype = Object.getPrototypeOf(prototype)) {
            if (prototype.constructor.COMMAND) {
                return prototype.constructor.COMMAND;
            }
        }
        throw new Error(`Invalid EmDatagram: missing command for type ${this.constructor.name}`);
    }

    protected abstract unpackPayload(buffer: Buffer): void;

    public unpack(buffer: Buffer) {
        const payloadLength = Datagram.assertValidDatagram(buffer);

        const command = buffer.readUint16BE(19);
        if (command !== this.getCommand()) {
            throw new Error(`Invalid EmDatagram: unexpected command ${command} for type ${this.constructor.name} with command ${this.getCommand()}`);
        }

        this._keyType = buffer.readUInt8(4);
        this._serial = buffer.toString("hex", 5, 13);
        const password = buffer.subarray(13, 19);
        if (password.every((byte) => byte === 0)) {
            this._password = undefined;
        } else {
            this._password = password.toString("ascii");
        }

        const payload = buffer.subarray(21, 21 + payloadLength);
        this.unpackPayload(payload);
        return payloadLength + 25;
    }

    protected readTemperature(buffer: Buffer, offset: number): number {
        const temp = buffer.readUInt16BE(offset);
        return temp === 0xffff ? -1.0 : Number(((temp - 20000) * 0.01).toFixed(2));
    }

    protected readString(buffer: Buffer, offset: number, length: number): string {
        return buffer.toString("ascii", offset, offset + length).replace(/\0+$/, "");
    }

    protected abstract packPayload(): Buffer;

    public pack(): Buffer {
        const command = this.getCommand();
        if (!command) throw new Error(`Invalid EmDatagram: missing command for type ${this.constructor.name}`);

        const payload = this.packPayload();

        const buffer = Buffer.alloc(25 + payload.length);
        buffer.writeUInt16BE(Datagram.PACKET_HEADER, 0);
        buffer.writeUInt16BE(buffer.length, 2);
        buffer.writeUInt8(this._keyType, 4);
        if (this._serial) {
            buffer.write(this._serial, 5, 8, "hex");
        }
        if (this._password !== undefined) {
            buffer.write(this._password, 13, 6, "ascii");
        }
        buffer.writeUInt16BE(command, 19);
        payload.copy(buffer, 21, 0, payload.length);
        const checksum = buffer.subarray(0, -4).reduce((acc, val) => (acc + val) % 0xffff, 0);
        buffer.writeUInt16BE(checksum, 25 + payload.length - 4);
        buffer.writeUInt16BE(Datagram.PACKET_TAIL, 25 + payload.length - 2);
        return buffer;
    }

    /**
     * Validate the datagram and return the length of the payload.
     * @param buffer Datagram byte buffer.
     * @private
     */
    private static assertValidDatagram(buffer: Buffer): number {
        if (buffer.length < 25) {
            throw new Error("Invalid EmDatagram: too short");
        }
        if (buffer.readUInt16BE(0) !== Datagram.PACKET_HEADER) {
            throw new Error("Invalid EmDatagram: missing magic header");
        }

        const length = buffer.readUInt16BE(2);
        if (length > buffer.length) {
            console.trace("Invalid EmDatagram: invalid length; buffer: " + buffer.toString("hex"));
            throw new Error("Invalid EmDatagram: invalid length");
        }

        const computedChecksum = buffer.subarray(0, length - 4).reduce((acc, val) => (acc + val) % 0xffff, 0);
        const checksum = buffer.readUInt16BE(length - 4);
        if (computedChecksum !== checksum) {
            console.trace("Invalid EmDatagram: invalid checksum (should be " + checksum + ", is " + computedChecksum + ", buffer: " + buffer.toString("hex") + " aka " + buffer.toString("ascii"));
            throw new Error("Invalid EmDatagram: invalid checksum");
        }

        return length - 25;
    }

    public get password(): string | undefined {
        return this._password;
    }

    public setPassword(password: string | undefined): this {
        this._password = password;
        return this;
    }

    public get serial(): string | undefined {
        return this._serial;
    }

    public setSerial(serial: string): this {
        this._serial = serial;
        return this;
    }

    public get keyType(): number {
        return this._keyType;
    }

    public setKeyType(keyType: number): this {
        this._keyType = keyType;
        return this;
    }

    public toString(): string {
        let str = `${this.constructor.name}/${this.getCommand()} serial=${this._serial}`;
        Object.entries(this).forEach(([key, value]) => {
            if (key === "deviceSerial" || key === "devicePassword" || key === "keyType" || value === undefined) return;
            if (typeof value === "function") return;
            str += ` ${key}=${value}`;
        });
        return str;
    }
}
