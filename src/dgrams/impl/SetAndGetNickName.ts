import Datagram from "../Datagram";
import { SetAndGetNickNameAction } from "../../util/types";
import { readString } from "../../util/util";

class SetAndGetNickNameAbstract extends Datagram {
    private action: SetAndGetNickNameAction = SetAndGetNickNameAction.GET;    // u8
    private nickName?: string; // 32 bytes

    public getAction(): SetAndGetNickNameAction {
        return this.action;
    }

    public setAction(action: SetAndGetNickNameAction): this {
        this.action = action;
        return this;
    }

    public getNickName(): string | undefined {
        return this.nickName;
    }

    public setNickName(nickname: string): this {
        this.nickName = nickname;
        return this;
    }

    protected packPayload(): Buffer {
        if (this.action !== SetAndGetNickNameAction.GET && this.action !== SetAndGetNickNameAction.SET) {
            throw new Error("Invalid action, must be GET or SET");
        }

        if (this.action === SetAndGetNickNameAction.SET && !this.nickName) {
            throw new Error("Nickname is required for SET action");
        }

        const buffer = Buffer.alloc(33);
        buffer.writeUInt8(this.action, 0);
        if (this.action === SetAndGetNickNameAction.SET) {
            buffer.write(this.nickName!, 1, 32, "binary");
        }
        return buffer;
    }

    protected unpackPayload(buffer: Buffer) {
        if (buffer.length < 17) {
            throw new Error("Invalid payload; too short");
        }

        const action = buffer.readUInt8(0) as SetAndGetNickNameAction;
        this.action = action || SetAndGetNickNameAction.UNKNOWN;
        this.nickName = readString(buffer, 1, buffer.length >= 33 ? 33 : 17);
    }
}

export class SetAndGetNickName extends SetAndGetNickNameAbstract {
    public static readonly COMMAND = 33032;
}

export class SetAndGetNickNameResponse extends SetAndGetNickNameAbstract {
    public static readonly COMMAND = 264;
}
