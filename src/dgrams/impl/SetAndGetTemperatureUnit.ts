import Datagram from "../Datagram";
import { Buffer } from "node:buffer";
import { SetAndGetTemperatureUnitAction, type TemperatureUnit, TemperatureUnitMapping } from "../../util/types";
import { enumStr } from "../../util/util";

abstract class SetAndGetTemperatureUnitAbstract extends Datagram {
    private action?: SetAndGetTemperatureUnitAction;
    private temperatureUnit?: TemperatureUnitMapping;

    unpackPayload(buffer: Buffer) {
        this.action = buffer.readUInt8(0) as SetAndGetTemperatureUnitAction || SetAndGetTemperatureUnitAction.UNKNOWN;
        this.temperatureUnit = buffer.readUInt8(1) as TemperatureUnitMapping || TemperatureUnitMapping.UNKNOWN;
    }

    packPayload(): Buffer {
        if (!this.action || ![SetAndGetTemperatureUnitAction.GET, SetAndGetTemperatureUnitAction.SET].includes(this.action)) {
            throw new Error(`Invalid SetAndGetTemperatureUnitAction: ${this.action}`);
        }

        if (!this.temperatureUnit) {
            throw new Error(`Invalid temperatureUnit: ${this.temperatureUnit}`);
        }

        return Buffer.of(this.action, this.action === SetAndGetTemperatureUnitAction.GET ? 0 : this.temperatureUnit);
    }

    public getAction(): SetAndGetTemperatureUnitAction | undefined {
        return this.action;
    }

    public setAction(action: SetAndGetTemperatureUnitAction): this {
        this.action = action;
        return this;
    }

    public getTemperatureUnit(): TemperatureUnit {
        return enumStr(this.temperatureUnit, TemperatureUnitMapping) as TemperatureUnit;
    }

    public setTemperatureUnit(temperatureUnit: TemperatureUnit): this {
        this.temperatureUnit = TemperatureUnitMapping[temperatureUnit];
        return this;
    }
}

export class SetAndGetTemperatureUnit extends SetAndGetTemperatureUnitAbstract {
    public static readonly COMMAND = 33042;
}

export class SetAndGetTemperatureUnitResponse extends SetAndGetTemperatureUnitAbstract {
    public static readonly COMMAND = 274;
}
