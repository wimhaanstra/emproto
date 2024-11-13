import EmDatagram from "../EmDatagram.js";
import { Buffer } from "node:buffer";

export class SingleACChargingStatusPublicAuto extends EmDatagram {

    public static readonly COMMAND = 0x0005;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        // console.log("5/SingleACChargingStatusPublicAuto payload: " + buffer.toString("hex"));
        // TODO
    }

}
