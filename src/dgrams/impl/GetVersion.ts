import Datagram from "../Datagram";
import { readString } from "../../util/util";

class GetVersionAbstract extends Datagram {
    private _hardwareVersion?: string;
    private _softwareVersion?: string;
    private _feature?: number;
    private _supportNew?: number;

    protected unpackPayload(buffer: Buffer): void {
        if (buffer.length < 37) throw new Error('Buffer too short');
        this._hardwareVersion = readString(buffer, 0, 16);
        this._softwareVersion = readString(buffer, 16, 32);
        this._feature = buffer.readUInt32BE(32);
        this._supportNew = buffer.readUInt8(36);
    }

    protected packPayload(): Buffer {
        return Buffer.of();
    }

    public get hardwareVersion(): string | undefined {
        return this._hardwareVersion;
    }

    public get softwareVersion(): string | undefined {
        return this._softwareVersion;
    }

    public get feature(): number | undefined {
        return this._feature;
    }

    public get supportNew(): number | undefined {
        return this._supportNew;
    }
}

export class GetVersion extends GetVersionAbstract {
    public static readonly COMMAND = 33030;
}

export class GetVersionResponse extends GetVersionAbstract {
    public static readonly COMMAND = 262;
}
