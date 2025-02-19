import Datagram from "../Datagram";

export class ChargeStop extends Datagram {
    public static readonly COMMAND = 32776;

    private _lineId: number = 1;
    private _userId?: string;

    protected packPayload(): Buffer {
        // Length: 47 bytes
        // Bytes 	Variable 	Type 	Notes
        // 00       lineId      u8
        // 01 - 16  userId      String
        // 17 - 46  zeroed
        const buffer = Buffer.alloc(47);
        buffer.writeUInt8(this._lineId, 0);
        buffer.write(this._userId || "emmgr", 1, 16, "ascii");
        return buffer;
    }

    protected unpackPayload(buffer: Buffer) {
        // Not used; this is an app->EVSE command.
    }

    public get lineId(): number {
        return this._lineId;
    }

    public setLineId(lineId?: number): this {
        if (!lineId) {
            return this;
        }
        if (lineId < 1) {
            throw new Error(`Invalid lineId: ${lineId}`);
        }
        this._lineId = lineId;
        return this;
    }

    public get userId(): string | undefined {
        return this._userId;
    }

    public setUserId(userId?: string): this {
        if (userId) {
            this._userId = userId;
        }
        return this;
    }

}

export class ChargeStopResponse extends Datagram {
    public static readonly COMMAND = 8;

    private _lineId?: number;
    private _stopResult?: number;
    private _failReason?: number;

    protected packPayload(): Buffer {
        // Not used; this is an EVSE response.
        return Buffer.alloc(0);
    }

    protected unpackPayload(buffer: Buffer) {
        // Bytes  Variable   Type  Notes
        // 00     lineId     u8
        // 01     stopResult u8
        // 02     failReason u8
        if (buffer.length < 3) {
            throw new Error(`Invalid ChargeStopResponse buffer length; expected 3, got ${buffer.length}`);
        }
        this._lineId = buffer.readUInt8(0);
        this._stopResult = buffer.readUInt8(1);
        this._failReason = buffer.readUInt8(2);
    }

    public get lineId(): number | undefined {
        return this._lineId;
    }

    public get stopResult(): number | undefined {
        return this._stopResult;
    }

    public get failReason(): number | undefined {
        return this._failReason;
    }

}
