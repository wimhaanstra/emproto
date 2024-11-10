import EmDatagram from "../EmDatagram.ts";
import { Buffer } from "node:buffer";

export class RequestStatusRecord extends EmDatagram {

    public static readonly COMMAND = 0x000d;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        // console.log("13/RequestStatusRecord payload: " + buffer.toString("hex"));
    }
}
