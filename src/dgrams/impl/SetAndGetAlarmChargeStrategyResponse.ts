import Datagram from "../Datagram";
import { Buffer } from "node:buffer";

export class SetAndGetAlarmChargeStrategyResponse extends Datagram {

    public static readonly COMMAND = 0x010e;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        // console.log("270/SetAndGetAlarmChargeStrategyResponse payload: " + buffer.toString("hex"));
    }

}
