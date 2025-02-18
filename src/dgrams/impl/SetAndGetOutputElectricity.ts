import Datagram from "../Datagram";
import { SetAndGetOutputElectricityAction } from "../../util/types";

abstract class SetAndGetOutputElectricityAbstract extends Datagram {
    private _action?: SetAndGetOutputElectricityAction;    // u8
    private _electricity?: number; // u8

    protected packPayload(): Buffer {
        if (this._action !== SetAndGetOutputElectricityAction.GET && this._action !== SetAndGetOutputElectricityAction.SET) {
            throw new Error("Invalid action, must be GET or SET");
        }

        if (!this._electricity && this._action == SetAndGetOutputElectricityAction.SET) {
            throw new Error("Electricity can't be undefined during SET action");
        }

        const buffer = Buffer.of(this._action, 0x00);

        if (this._action === SetAndGetOutputElectricityAction.SET) {
            if (this._electricity! < 6 || this._electricity! > 32) {
                // Note: also limited by the max supported rated current of the EVSE as returned in it's getInfo;
                //       many support only up to 16A. This is just a global sanity check on the param value.
                throw new Error("Invalid electricity (amps), must be between 6 and 32");
            }
            buffer.writeUInt8(this._electricity!, 1);
        }

        return buffer;
    }

    protected unpackPayload(buffer: Buffer) {
        this._action = buffer.readUInt8(0) as SetAndGetOutputElectricityAction || SetAndGetOutputElectricityAction.UNKNOWN;
        this._electricity = buffer.readUInt8(1);
    }

    public get action(): SetAndGetOutputElectricityAction | undefined {
        return this._action;
    }

    public setAction(action: SetAndGetOutputElectricityAction): this {
        this._action = action;
        return this;
    }

    public get electricity(): number | undefined {
        return this._electricity;
    }

    public setElectricity(electricity: number): this {
        this._electricity = electricity;
        return this;
    }
}

export class SetAndGetOutputElectricity extends SetAndGetOutputElectricityAbstract {
    public static readonly COMMAND = 33031;
}

export class SetAndGetOutputElectricityResponse extends SetAndGetOutputElectricityAbstract {
    public static readonly COMMAND = 263;
}
