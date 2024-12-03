import Datagram from "../Datagram.js";
import {SystemTimeAction} from "../../util/types.js";
import {Buffer} from "node:buffer";

abstract class SystemTimeAbstract extends Datagram {

    public action: SystemTimeAction;

    public time: Date;

    protected packPayload(): Buffer {
        const buffer = Buffer.alloc(5)
        if (this.action !== SystemTimeAction.GET && this.action !== SystemTimeAction.SET) {
            throw new Error("Invalid SystemTimeAction: must be GET or SET");
        }
        buffer.writeUInt8(this.action, 0);
        if (this.time === undefined && this.action === SystemTimeAction.SET) {
            this.time = new Date();
        }
        buffer.writeUInt32BE(this.time.getTime() / 1000, 1);
        return buffer;
    }

    protected unpackPayload(buffer: Buffer): void {
        if (buffer.length < 5) {
            throw new Error("Invalid EmDatagram SystemTime: too short payload")
        }
        this.action = SystemTimeAction[String(buffer.readUInt8(0))] || SystemTimeAction.UNKNOWN;
        this.time = new Date(buffer.readUInt32BE(1) * 1000);
    }

}

export class SettingSystemTime extends SystemTimeAbstract {
    public static readonly COMMAND = 0x0101;
}
