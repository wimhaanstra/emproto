import Datagram from "../Datagram";

export class CurrentChargeRecord extends Datagram {
    public static readonly COMMAND = 9;

    private _lineId: number = 1;
    private _startUserId?: string;
    private _endUserId?: string;
    private _chargeId?: string;
    private _hasReservation?: number; // u8
    private _startType?: number;  // u8
    private _chargeType?: number;  // u8
    private _chargeParam1?: number;   // u16
    private _chargeParam2?: number;   // float - Multiply by 0.001; 255.0 if value = 255
    private _chargeParam3?: number;   // float - Multiply by 0.01; 255.0 if value = 255
    private _stopReason?: number; // u8
    private _hasStopCharge?: number; // u8
    private _reservationData?: number; // u32
    private _startDate?: number; // u32
    private _stopDate?: number; // u32
    private _chargedTime?: number; // u32
    private _chargeStartPower?: number; // float - Multiply by 0.01
    private _chargeStopPower?: number; // float - Multiply by 0.01
    private _chargePower?: number; // float - Multiply by 0.01
    private _chargePrice?: number; // float - Multiply by 0.01
    private _feeType?: number; // u8
    private _chargeFee?: number; // float - Multiply by 0.01
    private _logKWLength?: number; // u16
    private _logKW?: number[]; // u16 - optional, only included if length >= 157
    private _logChargeDataKWh?: number[]; // u16 - optional, only included if length >= 253
    private _logChargeDataChargeFee?: number[]; // u16 - optional, only included if length >= 253
    private _logChargeDataServiceFee?: number[]; // u16 - optional, only included if length >= 253

    public get lineId(): number {
        return this._lineId;
    }

    public get startUserId(): string | undefined {
        return this._startUserId;
    }

    public get endUserId(): string | undefined {
        return this._endUserId;
    }

    public get chargeId(): string | undefined {
        return this._chargeId;
    }

    public get hasReservation(): number | undefined {
        return this._hasReservation;
    }

    public get startType(): number | undefined {
        return this._startType;
    }

    public get chargeType(): number | undefined {
        return this._chargeType;
    }

    public get chargeParam1(): number | undefined {
        return this._chargeParam1;
    }

    public get chargeParam2(): number | undefined {
        return this._chargeParam2;
    }

    public get chargeParam3(): number | undefined {
        return this._chargeParam3;
    }

    public get stopReason(): number | undefined {
        return this._stopReason;
    }

    public get hasStopCharge(): number | undefined {
        return this._hasStopCharge;
    }

    public get reservationData(): number | undefined {
        return this._reservationData;
    }

    public get startDate(): number | undefined {
        return this._startDate;
    }

    public get stopDate(): number | undefined {
        return this._stopDate;
    }

    public get chargedTime(): number | undefined {
        return this._chargedTime;
    }

    public get chargeStartPower(): number | undefined {
        return this._chargeStartPower;
    }

    public get chargeStopPower(): number | undefined {
        return this._chargeStopPower;
    }

    public get chargePower(): number | undefined {
        return this._chargePower;
    }

    public get chargePrice(): number | undefined {
        return this._chargePrice;
    }

    public get feeType(): number | undefined {
        return this._feeType;
    }

    public get chargeFee(): number | undefined {
        return this._chargeFee;
    }

    public get logKWLength(): number | undefined {
        return this._logKWLength;
    }

    public get logKW(): number[] | undefined {
        return this._logKW;
    }

    public get logChargeDataKWh(): number[] | undefined {
        return this._logChargeDataKWh;
    }

    public get logChargeDataChargeFee(): number[] | undefined {
        return this._logChargeDataChargeFee;
    }

    public get logChargeDataServiceFee(): number[] | undefined {
        return this._logChargeDataServiceFee;
    }

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        if (buffer.length < 97) {
            throw new Error("Invalid EmDatagram CurrentChargeRecord: too short payload")
        }

        this._lineId = buffer.readUInt8(0);
        this._startUserId = this.readString(buffer, 1, 16);
        this._endUserId = this.readString(buffer, 17, 16);
        this._chargeId = this.readString(buffer, 33, 16);
        this._hasReservation = buffer.readUInt8(49);
        this._startType = buffer.readUInt8(50);
        this._chargeType = buffer.readUInt8(51);
        this._chargeParam1 = buffer.readUInt16BE(52);
        this._chargeParam2 = buffer.readUInt16BE(54) * 0.001;
        this._chargeParam3 = buffer.readUInt16BE(56) * 0.01;
        this._stopReason = buffer.readUInt8(58);
        this._hasStopCharge = buffer.readUInt8(59);
        this._reservationData = buffer.readUInt32BE(60);
        this._startDate = buffer.readUInt32BE(64);
        this._stopDate = buffer.readUInt32BE(68);
        this._chargedTime = buffer.readUInt32BE(72);
        this._chargeStartPower = buffer.readUInt32BE(76) * 0.01;
        this._chargeStopPower = buffer.readUInt32BE(80) * 0.01;
        this._chargePower = buffer.readUInt32BE(84) * 0.01;
        this._chargePrice = buffer.readUInt32BE(88) * 0.01;
        this._feeType = buffer.readUInt8(92);
        this._chargeFee = buffer.readUInt16BE(93) * 0.01;
        this._logKWLength = buffer.readUInt16BE(95);
        if (buffer.length >= 156) {
            this._logKW = [];
            for (let i = 0; i < 60; i++) {
                this._logKW.push(buffer.readUInt16BE(96 + i * 2));
            }
        }
        if (buffer.length >= 252) {
            this._logChargeDataKWh = [];
            for (let i = 0; i < 96; i += 2) {
                this._logChargeDataKWh.push(buffer.readUInt16BE(156 + i));
            }
        }
        if (buffer.length >= 348) {
            this._logChargeDataChargeFee = [];
            for (let i = 0; i < 96; i += 2) {
                this._logChargeDataChargeFee.push(buffer.readUInt16BE(252 + i));
            }
        }
        if (buffer.length >= 446) {
            this._logChargeDataServiceFee = [];
            for (let i = 0; i < 96; i += 2) {
                this._logChargeDataServiceFee.push(buffer.readUInt16BE(348 + i));
            }
        }
    }

}

export class RequestChargeStatusRecord extends Datagram {
    public static readonly COMMAND = 32781;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        // Not used.
    }

}


export class CurrentChargeRecordResponse extends Datagram {
    public static readonly COMMAND = 32777;

    private _lineId: number = 1;  // u8
    private _chargeId?: string;  // string (16 char)
    private _status?: number;  // u8

    protected packPayload() {
        if (this._status === undefined) {
            throw new Error("Invalid CurrentChargeRecordResponse: status is required")
        }
        const buffer = Buffer.alloc(18);
        buffer.writeUInt8(this._lineId, 0);
        if (this._chargeId !== undefined) {
            buffer.write(this._chargeId, 1, 16, "ascii");
        }
        buffer.writeUInt8(this._status || 0, 17);
        return buffer;
    }

    public get lineId(): number {
        return this._lineId;
    }

    public get chargeId(): string | undefined {
        return this._chargeId;
    }

    public get status(): number | undefined {
        return this._status;
    }

    protected unpackPayload(buffer: Buffer): void {
        // Not used.
    }

    public setLineId(lineId: number): this {
        if (lineId < 1) {
            throw new Error(`Invalid lineId: ${lineId}`);
        }
        this._lineId = lineId;
        return this;
    }

    public setChargeId(chargeId: string): this {
        this._chargeId = chargeId;
        return this;
    }

    public setStatus(status: number): this {
        this._status = status;
        return this;
    }

}