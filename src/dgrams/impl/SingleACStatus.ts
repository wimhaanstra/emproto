import Datagram from "../Datagram";
import { Buffer } from "node:buffer";
import { EmEvseCurrentState, EmEvseError, EmEvseGunState, EmEvseOutputState } from "../../util/types";
import { parseErrorState } from "../../util/util";

export class SingleACStatus extends Datagram {
    public static readonly COMMAND = 4;

    private _lineId?: number; // u8
    private _l1Voltage?: number; // float - Multiply by 0.1f - L1
    private _l1Electricity?: number; // float - Multiply by 0.1f - L1
    private _currentPower?: number; // u32
    private _totalKWhCounter?: number; // float - Multiply by 0.01f     -- kWh?
    private _innerTemp?: number; // float - if 255: -1.0f, otherwise subtract 20 000 and multiply by 0.01f
    private _outerTemp?: number; // float - if 255: -1.0f, otherwise subtract 20 000 and multiply by 0.01f
    private _emergencyBtnState?: number; // u8
    private _gunState?: EmEvseGunState; // u8
    private _outputState?: number; // u8
    private _currentState?: EmEvseCurrentState; // u8
    private _errors?: EmEvseError[]; // u32 bitfield
    private _l2Voltage?: number; // float - Multiply by 0.1f - L2 - optional
    private _l2Electricity?: number; // float - Multiply by 0.01f - L2 - optional
    private _l3Voltage?: number; // float - Multiply by 0.1f - L3 - optional
    private _l3Electricity?: number; // float - Multiply by 0.01f - L3 - optional

    public get lineId(): number | undefined {
        return this._lineId;
    }

    public get l1Voltage(): number | undefined {
        return this._l1Voltage;
    }

    public get l1Electricity(): number | undefined {
        return this._l1Electricity;
    }

    public get currentPower(): number | undefined {
        return this._currentPower;
    }

    public get totalKWhCounter(): number | undefined {
        return this._totalKWhCounter;
    }

    public get innerTemp(): number | undefined {
        return this._innerTemp;
    }

    public get outerTemp(): number | undefined {
        return this._outerTemp;
    }

    public get emergencyBtnState(): number | undefined {
        return this._emergencyBtnState;
    }

    public get gunState(): EmEvseGunState | undefined {
        return this._gunState;
    }

    public get outputState(): number | undefined {
        return this._outputState;
    }

    public get currentState(): EmEvseCurrentState | undefined {
        return this._currentState;
    }

    public get errors(): EmEvseError[] | undefined {
        return this._errors;
    }

    public get l2Voltage(): number | undefined {
        return this._l2Voltage;
    }

    public get l2Electricity(): number | undefined {
        return this._l2Electricity;
    }

    public get l3Voltage(): number | undefined {
        return this._l3Voltage;
    }

    public get l3Electricity(): number | undefined {
        return this._l3Electricity;
    }

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        if (buffer.length < 25) {
            throw new Error("Invalid EmDatagram SingleACStatus: too short payload")
        }

        this._lineId = buffer.readUInt8(0);
        this._l1Voltage = buffer.readUInt16BE(1) * 0.1;
        this._l1Electricity = buffer.readUInt16BE(3) * 0.01;
        this._currentPower = buffer.readUInt32BE(5);
        this._totalKWhCounter = buffer.readUInt32BE(9) * 0.01;
        this._innerTemp = this.readTemperature(buffer, 13);
        this._outerTemp = this.readTemperature(buffer, 15);
        this._emergencyBtnState = buffer.readUInt8(17);
        this._gunState = buffer.readUInt8(18) as EmEvseGunState || EmEvseGunState.UNKNOWN_OTHER;
        this._outputState = buffer.readUInt8(19) as EmEvseOutputState || EmEvseOutputState.UNKNOWN_OTHER;
        this._currentState = buffer.readUInt8(20) as EmEvseCurrentState || EmEvseCurrentState.UNKNOWN;
        this._errors = parseErrorState(buffer.readUInt32BE(21));
        this._l2Voltage = buffer.length >= 33 ? buffer.readUInt16BE(25) * 0.1 : 0;
        this._l2Electricity = buffer.length >= 33 ? buffer.readUInt16BE(27) * 0.01 : 0;
        this._l3Voltage = buffer.length >= 33 ? buffer.readUInt16BE(29) * 0.1 : 0;
        this._l3Electricity = buffer.length >= 33 ? buffer.readUInt16BE(31) * 0.01 : 0;
    }

}

export class SingleACStatusResponse extends Datagram {
    public static readonly COMMAND = 32772;

    protected packPayload() {
        return Buffer.of(0x01);
    }

    protected unpackPayload(buffer: Buffer): void {
        // Unused: this is an app->EVSE datagram.
    }

}