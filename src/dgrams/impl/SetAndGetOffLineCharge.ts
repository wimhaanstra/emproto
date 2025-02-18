import Datagram from "../Datagram";
import { OffLineChargeAction, type OffLineChargeStatus, OffLineChargeStatusMapping } from "../../util/types";
import { enumStr } from "../../util/util";

abstract class SetAndGetOffLineChargeAbstract extends Datagram {
    private _status?: OffLineChargeStatusMapping;
    private _action?: OffLineChargeAction;

    protected packPayload() {
        if (!this._action || (this._action === OffLineChargeAction.SET && !this._status)) {
            throw new Error('Missing status');
        }

        return Buffer.of(this._action, this._action === OffLineChargeAction.GET ? 0 : this._status!);
    }

    protected unpackPayload(buffer: Buffer) {
        if (buffer.length < 2) {
            throw new Error("269/SetAndGetOffLineChargeResponse payload too small");
        }
        this._action = buffer.readUInt8(0) as OffLineChargeAction || OffLineChargeAction.UNKNOWN;
        this._status = buffer.readUInt8(1) as OffLineChargeStatusMapping || OffLineChargeStatusMapping.UNKNOWN;
    }

    public get action(): OffLineChargeAction | undefined {
        return this._action;
    }

    public setAction(action: OffLineChargeAction): this {
        this._action = action;
        return this;
    }

    public get status(): OffLineChargeStatus {
        return enumStr(this._status, OffLineChargeStatusMapping) as OffLineChargeStatus;
    }

    public setStatus(status: OffLineChargeStatus): this {
        this._status = OffLineChargeStatusMapping[status];
        return this;
    }
}

export class SetAndGetOffLineCharge extends SetAndGetOffLineChargeAbstract {
    public static readonly COMMAND = 33037;
}

export class SetAndGetOffLineChargeResponse extends SetAndGetOffLineChargeAbstract {
    public static readonly COMMAND = 269;
}
