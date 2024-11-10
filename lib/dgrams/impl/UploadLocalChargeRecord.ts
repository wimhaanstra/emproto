import EmDatagram from "../EmDatagram.ts";

export class UploadLocalChargeRecord extends EmDatagram {

    public static readonly COMMAND = 10;

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        // TODO
    }
}
