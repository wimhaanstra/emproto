import Datagram from "../Datagram";
import { SystemTimeAction } from "../../util/types";
import { Buffer } from "node:buffer";
import { dateToEmTimestamp, emTimestampToDate } from "../../util/util";


abstract class SystemTimeAbstract extends Datagram {
    private action: SystemTimeAction | undefined;
    private time: Date | undefined;

    unpackPayload(buffer: Buffer) {
        const value = Number(String(buffer.readUInt8(0)));
        this.action = value as SystemTimeAction || SystemTimeAction.UNKNOWN;
        this.time = emTimestampToDate(buffer.readUInt32BE(1));
    }

    packPayload(): Buffer {
        if (!this.action || ![SystemTimeAction.GET, SystemTimeAction.SET].includes(this.action)) {
            throw new Error(`Invalid GetAndSetSystemTimeAction: ${this.action}`);
        }

        const buffer = Buffer.alloc(5);
        buffer.writeUInt8(this.action, 0);

        if (this.action === SystemTimeAction.SET) {
            if (!this.time || this.time.getTime() === 0) {
                this.time = new Date();
            }
            buffer.writeUInt32BE(dateToEmTimestamp(this.time), 1);
        }

        return buffer;
    }

    public getAction(): SystemTimeAction | undefined {
        return this.action;
    }

    public setAction(action: SystemTimeAction): this {
        this.action = action;
        return this;
    }

    public getTime(): Date | undefined {
        return this.time;
    }

    public setTime(time: Date): this {
        this.time = time;
        return this;
    }

}

export class SetAndGetSystemTime extends SystemTimeAbstract {
    public static readonly COMMAND = 33025;
}

export class SetAndGetSystemTimeResponse extends SystemTimeAbstract {
    public static readonly COMMAND = 257;
}
