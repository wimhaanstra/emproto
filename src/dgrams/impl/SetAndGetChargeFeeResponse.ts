import EmDatagram from "../EmDatagram.js";
import { Buffer } from "node:buffer";

export class SetAndGetChargeFeeResponse extends EmDatagram {

    public static readonly COMMAND = 0x0104;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        // console.log("260/SetAndGetChargeFeeResponse payload: " + buffer.toString("hex"));
    }
}
