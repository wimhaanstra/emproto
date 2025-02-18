import Datagram from "../Datagram";

export class PasswordErrorResponse extends Datagram {
    public static readonly COMMAND = 341;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        // No payload.
    }
}
