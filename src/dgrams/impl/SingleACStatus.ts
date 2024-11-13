import EmDatagram from "../EmDatagram.js";
import { Buffer } from "node:buffer";
import { EmEvseCurrentState, EmEvseErrorState, EmEvseGunState, EmEvseOutputState } from "../../util/types.js";
import { parseErrorState } from "../../util/util.js";

export class SingleACStatus extends EmDatagram {
    public static readonly COMMAND = 0x0004;

    protected packPayload() {
        return Buffer.of();
    }

    public lineId: number; // u8
    public l1Voltage: number; // float - Multiply by 0.1f - L1
    public l1Electricity: number; // float - Multiply by 0.1f - L1
    public currentPower: number; // u32
    public currentAmount: number; // float - Multiply by 0.01f     -- kWh?
    public innerTemp: number; // float - if 255: -1.0f, otherwise subtract 20 000 and multiply by 0.01f
    public outerTemp: number; // float - if 255: -1.0f, otherwise subtract 20 000 and multiply by 0.01f
    public emergencyBtnState: number; // u8
    public gunState: EmEvseGunState; // u8
    public outputState: number; // u8
    public currentState: EmEvseCurrentState; // u8
    public errorState: EmEvseErrorState[]; // u32 bitfield
    public l2Voltage: number; // float - Multiply by 0.1f - L2 - optional
    public l2Electricity: number; // float - Multiply by 0.01f - L2 - optional
    public l3Voltage: number; // float - Multiply by 0.1f - L3 - optional
    public l3Electricity: number; // float - Multiply by 0.01f - L3 - optional

    protected unpackPayload(buffer: Buffer): void {
        if (buffer.length < 25) {
            throw new Error("Invalid EmDatagram SingleACStatus: too short payload")
        }

        this.lineId = buffer.readUInt8(0);
        this.l1Voltage = buffer.readUInt16BE(1) * 0.1;
        this.l1Electricity = buffer.readUInt16BE(3) * 0.01;
        this.currentPower = buffer.readUInt32BE(5);
        this.currentAmount = buffer.readUInt32BE(9) * 0.01;
        this.innerTemp = this.readTemperature(buffer, 13);
        this.outerTemp = this.readTemperature(buffer, 15);
        this.emergencyBtnState = buffer.readUInt8(17);
        this.gunState = EmEvseGunState[String(buffer.readUInt8(18))] || EmEvseGunState.UNKNOWN_OTHER;
        this.outputState = EmEvseOutputState[String(buffer.readUInt8(19))] || EmEvseOutputState.UNKNOWN_OTHER;
        this.currentState = EmEvseCurrentState[String(buffer.readUInt8(20))] || EmEvseCurrentState.UNKNOWN;
        this.errorState = parseErrorState(buffer.readUInt32BE(21));
        this.l2Voltage = buffer.length >= 33 ? buffer.readUInt16BE(25) * 0.1 : 0;
        this.l2Electricity = buffer.length >= 33 ? buffer.readUInt16BE(27) * 0.01 : 0;
        this.l3Voltage = buffer.length >= 33 ? buffer.readUInt16BE(29) * 0.1 : 0;
        this.l3Electricity = buffer.length >= 33 ? buffer.readUInt16BE(31) * 0.01 : 0;
    }

}

export class SingleACStatusResponse extends EmDatagram {
    public static readonly COMMAND = 0x8004;

    protected packPayload() {
        return Buffer.of(0x01);
    }

    protected unpackPayload(buffer): void {
        // Unused: this is an app->EVSE datagram.
    }

}
