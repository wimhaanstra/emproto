import Datagram from "../Datagram.js";
import { Buffer } from "node:buffer";
import { SetAndGetTemperatureUnitAction, type TemperatureUnit, TemperatureUnitMapping } from "../../util/types.js";
import { enumStr } from "../../util/util.js";

abstract class SetAndGetTemperatureUnitAbstract extends Datagram {
    private action: SetAndGetTemperatureUnitAction;
    private temperatureUnit: TemperatureUnitMapping;

    unpackPayload(buffer: Buffer) {
        this.action = SetAndGetTemperatureUnitAction[String(buffer.readUInt8(0))] || SetAndGetTemperatureUnitAction.UNKNOWN;
        this.temperatureUnit = TemperatureUnitMapping[String(buffer.readUInt8(1))] || TemperatureUnitMapping.UNKNOWN;
    }

    packPayload(): Buffer {
        if (![SetAndGetTemperatureUnitAction.GET, SetAndGetTemperatureUnitAction.SET].includes(this.action)) {
            throw new Error(`Invalid SetAndGetTemperatureUnitAction: ${this.action}`);
        }

        return Buffer.of(this.action, this.action === SetAndGetTemperatureUnitAction.GET ? 0 : this.temperatureUnit);
    }

    public getAction(): SetAndGetTemperatureUnitAction {
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
