import EmDatagram from "../EmDatagram.js";

export class PasswordErrorResponse extends EmDatagram {
    public static readonly COMMAND = 341;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        // No payload.
    }
}
