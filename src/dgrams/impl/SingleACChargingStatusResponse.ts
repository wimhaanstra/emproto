import EmDatagram from "../EmDatagram.js";
import { Buffer } from "node:buffer";

export class SingleACChargingStatusResponse extends EmDatagram {

    public static readonly COMMAND = 0x0006;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer) {
        // TODO
    }

}
