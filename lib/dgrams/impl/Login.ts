import EmDatagram from "../EmDatagram.ts";
import { Buffer } from "node:buffer";

export abstract class LoginAbstract extends EmDatagram {
    private type: number; // u8
    private brand: string; // String
    private model: string; // String
    private hardwareVersion: string; // String
    private maxPower: number; // u32
    private maxElectricity: number; // u8
    private hotLine: string; // String

    protected packPayload() {
        return Buffer.of();
    }

    protected unpackPayload(buffer: Buffer): void {
        this.type = buffer.readUInt8(0);
        this.brand = this.readString(buffer, 1, 16);
        this.model = this.readString(buffer, 17, 16);
        this.hardwareVersion = this.readString(buffer, 33, 16);
        this.maxPower = buffer.readUInt32BE(49);
        this.maxElectricity = buffer.readUInt8(53);
        this.hotLine = this.readString(buffer, 54, 16);
        if (buffer.length === 118) {
            this.hotLine += this.readString(buffer, 70, 48);
        } else if (buffer.length === 119 || buffer.length === 151) {
            this.hotLine += this.readString(buffer, 71, 48);
        }
        if (buffer.length === 151) {
            this.brand += this.readString(buffer, 119, 16);
            this.model += this.readString(buffer, 135, 16);
        }
    }

    public getType(): number {
        return this.type;
    }

    public getBrand(): string {
        return this.brand;
    }

    public getModel(): string {
        return this.model;
    }

    public getHardwareVersion(): string {
        return this.hardwareVersion;
    }

    public getMaxPower(): number {
        return this.maxPower;
    }

    public getMaxElectricity(): number {
        return this.maxElectricity;
    }

    public getHotLine(): string {
        return this.hotLine;
    }
}

export class Login extends LoginAbstract {
    public static readonly COMMAND = 0x0001;
}

export class LoginResponse extends LoginAbstract {
    public static readonly COMMAND = 0x0002;
}

export class RequestLogin extends EmDatagram {
    public static readonly COMMAND = 0x8002;

    protected packPayload() {
        return Buffer.of(0x00);
    }

    protected unpackPayload(buffer: Buffer): void {
        // Unused: this is an app->EVSE datagram.
    }
}

export class LoginConfirm extends EmDatagram {
    public static readonly COMMAND = 0x8001;

    protected packPayload() {
        return Buffer.of(0x00);
    }

    protected unpackPayload(buffer: Buffer): void {
        // Unused: this is an outgoing command.
    }
}
