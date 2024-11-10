import EmDatagram from "../EmDatagram.ts";
import { Buffer } from "node:buffer";

export class Heading extends EmDatagram {
    public static readonly COMMAND = 0x0003;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer): void {
        // Has no payload.
    }
}

export class HeadingResponse extends EmDatagram {
    public static readonly COMMAND = 32771;

    protected packPayload(): Buffer {
        return Buffer.of(0x00);
    }

    protected unpackPayload(buffer: Buffer) {
        // Unused; this is a response to the EVSE's Heading datagram.
    }
}
