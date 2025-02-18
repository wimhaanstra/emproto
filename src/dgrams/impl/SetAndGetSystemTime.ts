import Datagram from "../Datagram";
import { SystemTimeAction } from "../../util/types";
import { Buffer } from "node:buffer";
import { dateToEmTimestamp, emTimestampToDate } from "../../util/util";


abstract class SystemTimeAbstract extends Datagram {
    private _action: SystemTimeAction | undefined;
    private _time: Date | undefined;

    unpackPayload(buffer: Buffer) {
        const value = Number(String(buffer.readUInt8(0)));
        this._action = value as SystemTimeAction || SystemTimeAction.UNKNOWN;
        this._time = emTimestampToDate(buffer.readUInt32BE(1));
    }

    packPayload(): Buffer {
        if (!this._action || ![SystemTimeAction.GET, SystemTimeAction.SET].includes(this._action)) {
            throw new Error(`Invalid GetAndSetSystemTimeAction: ${this._action}`);
        }

        const buffer = Buffer.alloc(5);
        buffer.writeUInt8(this._action, 0);

        if (this._action === SystemTimeAction.SET) {
            if (!this._time || this._time.getTime() === 0) {
                this._time = new Date();
            }
            buffer.writeUInt32BE(dateToEmTimestamp(this._time), 1);
        }

        return buffer;
    }

    public get action(): SystemTimeAction | undefined {
        return this._action;
    }

    public setAction(action: SystemTimeAction): this {
        this._action = action;
        return this;
    }

    public get time(): Date | undefined {
        return this._time;
    }

    public setTime(time: Date): this {
        this._time = time;
        return this;
    }

}

export class SetAndGetSystemTime extends SystemTimeAbstract {
    public static readonly COMMAND = 33025;
}

export class SetAndGetSystemTimeResponse extends SystemTimeAbstract {
    public static readonly COMMAND = 257;
}
