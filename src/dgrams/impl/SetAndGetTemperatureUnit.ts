import Datagram from "../Datagram";
import { Buffer } from "node:buffer";
import { SetAndGetTemperatureUnitAction, type TemperatureUnit, TemperatureUnitMapping } from "../../util/types";
import { enumStr } from "../../util/util";

abstract class SetAndGetTemperatureUnitAbstract extends Datagram {
    private _action?: SetAndGetTemperatureUnitAction;
    private _temperatureUnit?: TemperatureUnitMapping;

    unpackPayload(buffer: Buffer) {
        this._action = buffer.readUInt8(0) as SetAndGetTemperatureUnitAction || SetAndGetTemperatureUnitAction.UNKNOWN;
        this._temperatureUnit = buffer.readUInt8(1) as TemperatureUnitMapping || TemperatureUnitMapping.UNKNOWN;
    }

    packPayload(): Buffer {
        if (!this._action || ![SetAndGetTemperatureUnitAction.GET, SetAndGetTemperatureUnitAction.SET].includes(this._action)) {
            throw new Error(`Invalid SetAndGetTemperatureUnitAction: ${this._action}`);
        }

        if (!this._temperatureUnit) {
            throw new Error(`Invalid temperatureUnit: ${this._temperatureUnit}`);
        }

        return Buffer.of(this._action, this._action === SetAndGetTemperatureUnitAction.GET ? 0 : this._temperatureUnit);
    }

    public get action(): SetAndGetTemperatureUnitAction | undefined {
        return this._action;
    }

    public setAction(action: SetAndGetTemperatureUnitAction): this {
        this._action = action;
        return this;
    }

    public get temperatureUnit(): TemperatureUnit {
        return enumStr(this._temperatureUnit, TemperatureUnitMapping) as TemperatureUnit;
    }

    public setTemperatureUnit(temperatureUnit: TemperatureUnit): this {
        this._temperatureUnit = TemperatureUnitMapping[temperatureUnit];
        return this;
    }
}

export class SetAndGetTemperatureUnit extends SetAndGetTemperatureUnitAbstract {
    public static readonly COMMAND = 33042;
}

export class SetAndGetTemperatureUnitResponse extends SetAndGetTemperatureUnitAbstract {
    public static readonly COMMAND = 274;
}
