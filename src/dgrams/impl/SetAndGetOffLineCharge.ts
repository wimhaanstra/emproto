import Datagram from "../Datagram";
import { OffLineChargeAction, type OffLineChargeStatus, OffLineChargeStatusMapping } from "../../util/types";
import { enumStr } from "../../util/util";

abstract class SetAndGetOffLineChargeAbstract extends Datagram {
    private status?: OffLineChargeStatusMapping;
    private action?: OffLineChargeAction;

    protected packPayload() {
        if (!this.action || (this.action === OffLineChargeAction.SET && !this.status)) {
            throw new Error('Missing status');
        }

        return Buffer.of(this.action, this.action === OffLineChargeAction.GET ? 0 : this.status!);
    }

    protected unpackPayload(buffer: Buffer) {
        if (buffer.length < 2) {
            throw new Error("269/SetAndGetOffLineChargeResponse payload too small");
        }
        this.action = buffer.readUInt8(0) as OffLineChargeAction || OffLineChargeAction.UNKNOWN;
        this.status = buffer.readUInt8(1) as OffLineChargeStatusMapping || OffLineChargeStatusMapping.UNKNOWN;
    }

    public getAction(): OffLineChargeAction | undefined {
        return this.action;
    }

    public setAction(action: OffLineChargeAction): this {
        this.action = action;
        return this;
    }

    public getStatus(): OffLineChargeStatus {
        return enumStr(this.status, OffLineChargeStatusMapping) as OffLineChargeStatus;
    }

    public setStatus(status: OffLineChargeStatus): this {
        this.status = OffLineChargeStatusMapping[status];
        return this;
    }
}

export class SetAndGetOffLineCharge extends SetAndGetOffLineChargeAbstract {
    public static readonly COMMAND = 33037;
}

export class SetAndGetOffLineChargeResponse extends SetAndGetOffLineChargeAbstract {
    public static readonly COMMAND = 269;
}
