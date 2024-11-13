import EmDatagram from "../EmDatagram.js";
import { Buffer } from "node:buffer";

export class SetAndGetServiceFeeResponse extends EmDatagram {

    public static readonly COMMAND = 0x0105;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        // console.log("261/SetAndGetServiceFeeResponse payload: " + buffer.toString("hex"));
    }
}
