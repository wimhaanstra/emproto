import EmDatagram from "../EmDatagram.ts";
import { SetAndGetOutputElectricityAction } from "../../../util/types.ts";

abstract class SetAndGetOutputElectricityAbstract extends EmDatagram {
    private action: SetAndGetOutputElectricityAction;    // u8
    private electricity: number; // u8

    protected packPayload(): Buffer {
        if (this.action !== SetAndGetOutputElectricityAction.GET && this.action !== SetAndGetOutputElectricityAction.SET) {
            throw new Error("Invalid action, must be GET or SET");
        }

        const buffer = Buffer.of(this.action, 0x00);

        if (this.action === SetAndGetOutputElectricityAction.SET) {
            if (this.electricity < 6 || this.electricity > 32) {
                // Note: also limited by the max supported rated current of the EVSE as returned in it's getInfo;
                //       many support only up to 16A. This is just a global sanity check on the param value.
                throw new Error("Invalid electricity (amps), must be between 6 and 32");
            }
            buffer.writeUInt8(this.electricity, 1);
        }

        return buffer;
    }

    protected unpackPayload(buffer: Buffer) {
        this.action = SetAndGetOutputElectricityAction[String(buffer.readUInt8(0))] || SetAndGetOutputElectricityAction.UNKNOWN;
        this.electricity = buffer.readUInt8(1);
    }

    public getAction(): SetAndGetOutputElectricityAction {
        return this.action;
    }

    public setAction(action: SetAndGetOutputElectricityAction): this {
        this.action = action;
        return this;
    }

    public getElectricity(): number {
        return this.electricity;
    }

    public setElectricity(electricity: number): this {
        this.electricity = electricity;
        return this;
    }
}

export class SetAndGetOutputElectricity extends SetAndGetOutputElectricityAbstract {
    public static readonly COMMAND = 33031;
}

export class SetAndGetOutputElectricityResponse extends SetAndGetOutputElectricityAbstract {
    public static readonly COMMAND = 263;
}
