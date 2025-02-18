import Datagram from "../Datagram";
import { Buffer } from "node:buffer";

export abstract class LoginAbstract extends Datagram {
    private _type?: number; // u8
    private _brand?: string; // String
    private _model?: string; // String
    private _hardwareVersion?: string; // String
    private _maxPower?: number; // u32
    private _maxElectricity?: number; // u8
    private _hotLine?: string; // String

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        this._type = buffer.readUInt8(0);
        this._brand = this.readString(buffer, 1, 16);
        this._model = this.readString(buffer, 17, 16);
        this._hardwareVersion = this.readString(buffer, 33, 16);
        this._maxPower = buffer.readUInt32BE(49);
        this._maxElectricity = buffer.readUInt8(53);
        this._hotLine = this.readString(buffer, 54, 16);
        if (buffer.length === 118) {
            this._hotLine += this.readString(buffer, 70, 48);
        } else if (buffer.length === 119 || buffer.length === 151) {
            this._hotLine += this.readString(buffer, 71, 48);
        }
        if (buffer.length === 151) {
            this._brand += this.readString(buffer, 119, 16);
            this._model += this.readString(buffer, 135, 16);
        }
    }

    public get type(): number | undefined {
        return this._type;
    }

    public get brand(): string | undefined {
        return this._brand;
    }

    public get model(): string | undefined {
        return this._model;
    }

    public get hardwareVersion(): string | undefined {
        return this._hardwareVersion;
    }

    public get maxPower(): number | undefined {
        return this._maxPower;
    }

    public get maxElectricity(): number | undefined {
        return this._maxElectricity;
    }

    public get hotLine(): string | undefined {
        return this._hotLine;
    }
}

export class Login extends LoginAbstract {
    public static readonly COMMAND = 0x0001;
}

export class LoginResponse extends LoginAbstract {
    public static readonly COMMAND = 0x0002;
}

export class RequestLogin extends Datagram {
    public static readonly COMMAND = 0x8002;

    protected packPayload() {
        return Buffer.of(0x00);
    }

    protected unpackPayload(buffer: Buffer): void {
        // Unused: this is an app->EVSE datagram.
    }
}

export class LoginConfirm extends Datagram {
    public static readonly COMMAND = 0x8001;

    protected packPayload() {
        return Buffer.of(0x00);
    }

    protected unpackPayload(buffer: Buffer): void {
        // Unused: this is an outgoing command.
    }
}
