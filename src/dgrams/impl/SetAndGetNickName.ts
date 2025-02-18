import Datagram from "../Datagram";
import { SetAndGetNickNameAction } from "../../util/types";
import { readString } from "../../util/util";

class SetAndGetNickNameAbstract extends Datagram {
    private _action: SetAndGetNickNameAction = SetAndGetNickNameAction.GET;    // u8
    private _nickName?: string; // 32 bytes

    public get action(): SetAndGetNickNameAction {
        return this._action;
    }

    public setAction(action: SetAndGetNickNameAction): this {
        this._action = action;
        return this;
    }

    public get nickName(): string | undefined {
        return this._nickName;
    }

    public setNickName(nickname: string): this {
        this._nickName = nickname;
        return this;
    }

    protected packPayload(): Buffer {
        if (this._action !== SetAndGetNickNameAction.GET && this._action !== SetAndGetNickNameAction.SET) {
            throw new Error("Invalid action, must be GET or SET");
        }

        if (this._action === SetAndGetNickNameAction.SET && !this._nickName) {
            throw new Error("Nickname is required for SET action");
        }

        const buffer = Buffer.alloc(33);
        buffer.writeUInt8(this._action, 0);
        if (this._action === SetAndGetNickNameAction.SET) {
            buffer.write(this._nickName!, 1, 32, "binary");
        }
        return buffer;
    }

    protected unpackPayload(buffer: Buffer) {
        if (buffer.length < 17) {
            throw new Error("Invalid payload; too short");
        }

        const action = buffer.readUInt8(0) as SetAndGetNickNameAction;
        this._action = action || SetAndGetNickNameAction.UNKNOWN;
        this._nickName = readString(buffer, 1, buffer.length >= 33 ? 33 : 17);
    }
}

export class SetAndGetNickName extends SetAndGetNickNameAbstract {
    public static readonly COMMAND = 33032;
}

export class SetAndGetNickNameResponse extends SetAndGetNickNameAbstract {
    public static readonly COMMAND = 264;
}
