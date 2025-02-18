import Datagram from "../Datagram";
import { Buffer } from "node:buffer";
import { emTimestampToDate } from "../../util/util";
import { EmEvseCurrentState } from "../../util/types";

export abstract class SingleACChargingStatus extends Datagram {

    private _port?: number;
    private _currentState?: EmEvseCurrentState;    // 13=finished, 14=charging // EmEvseCurrentState
    private _chargeId?: string;
    private _startType?: number;
    private _chargeType?: number;
    private _maxDurationMinutes?: number;  // param 1
    private _maxEnergyKWh?: number;        // param 2
    private _chargeParam3?: number;
    private _reservationDate?: Date;
    private _userId?: string;
    private _maxElectricity?: number;
    private _startDate?: Date;
    private _durationSeconds?: number;
    private _startKWhCounter?: number;   // 0 if session finished.
    private _currentKWhCounter?: number;   // still filled when session finished.
    private _chargeKWh?: number;   // currentKWhCounter - startKWhCounter if session is active; filled with last value if session finished (startKWhCounter is set to 0 then)
    private _chargePrice?: number;
    private _feeType?: number;
    private _chargeFee?: number;

    public get port(): number | undefined {
        return this._port;
    }

    public get currentState(): EmEvseCurrentState | undefined {
        return this._currentState;
    }

    public get chargeId(): string | undefined {
        return this._chargeId;
    }

    public get startType(): number | undefined {
        return this._startType;
    }

    public get chargeType(): number | undefined {
        return this._chargeType;
    }

    public get maxDurationMinutes(): number | undefined {
        return this._maxDurationMinutes;
    }

    public get maxEnergyKWh(): number | undefined {
        return this._maxEnergyKWh;
    }

    public get chargeParam3(): number | undefined {
        return this._chargeParam3;
    }

    public get reservationDate(): Date | undefined {
        return this._reservationDate;
    }

    public get userId(): string | undefined {
        return this._userId;
    }

    public get maxElectricity(): number | undefined {
        return this._maxElectricity;
    }

    public get startDate(): Date | undefined {
        return this._startDate;
    }

    public get durationSeconds(): number | undefined {
        return this._durationSeconds;
    }

    public get startKWhCounter(): number | undefined {
        return this._startKWhCounter;
    }

    public get currentKWhCounter(): number | undefined {
        return this._currentKWhCounter;
    }

    public get chargeKWh(): number | undefined {
        return this._chargeKWh;
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

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        if (buffer.length < 74) {
            throw new Error("Invalid EmDatagram SingleACChargingStatus: too short payload")
        }

        this._port = buffer.readUInt8(0);
        const currentState = buffer.length <= 74 || ![18, 19].includes(buffer.readUInt8(74)) ? buffer.readUInt8(1) : buffer.readUInt8(74);
        this._currentState = currentState as EmEvseCurrentState || EmEvseCurrentState.UNKNOWN;
        this._chargeId = this.readString(buffer, 2, 16);
        this._startType = buffer.readUInt8(18);
        this._chargeType = buffer.readUInt8(19);
        this._maxDurationMinutes = buffer.readUInt16BE(20) === 65535 ? undefined : buffer.readUInt16BE(20);
        this._maxEnergyKWh = buffer.readUInt16BE(22) === 65535 ? undefined : buffer.readUInt16BE(22) * 0.01;
        this._chargeParam3 = buffer.readUInt16BE(24) === 65535 ? undefined : buffer.readUInt16BE(24) * 0.01;
        this._reservationDate = emTimestampToDate(buffer.readUInt32BE(26));
        this._userId = this.readString(buffer, 30, 16);
        this._maxElectricity = buffer.readUInt8(46);
        this._startDate = emTimestampToDate(buffer.readUInt32BE(47));
        this._durationSeconds = buffer.readUInt32BE(51);
        this._startKWhCounter = buffer.readUInt32BE(55) * 0.01;
        this._currentKWhCounter = buffer.readUInt32BE(59) * 0.01;
        this._chargeKWh = buffer.readUInt32BE(63) * 0.01;
        this._chargePrice = buffer.readUInt32BE(67) * 0.01;
        this._feeType = buffer.readUInt8(71);
        this._chargeFee = buffer.readUInt16BE(72) * 0.01;
    }

}

export class SingleACChargingStatusResponse extends SingleACChargingStatus {

    public static readonly COMMAND = 6;

}

export class SingleACChargingStatusPublicAuto extends SingleACChargingStatus {

    public static readonly COMMAND = 5;

}
