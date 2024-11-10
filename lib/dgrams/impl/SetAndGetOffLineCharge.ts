import EmDatagram from "../EmDatagram.ts";
import { OffLineChargeAction, type OffLineChargeStatus, OffLineChargeStatusMapping } from "../../../util/types.ts";
import { enumStr } from "../../../util/util.ts";

abstract class SetAndGetOffLineChargeAbstract extends EmDatagram {
    private status: OffLineChargeStatusMapping;
    private action: OffLineChargeAction;

    protected packPayload() {
        return Buffer.of(this.action, this.action === OffLineChargeAction.GET ? 0 : this.status);
    }

    protected unpackPayload(buffer: Buffer) {
        if (buffer.length < 2) {
            throw new Error("269/SetAndGetOffLineChargeResponse payload too small");
        }
        this.action = OffLineChargeAction[String(buffer.readUInt8(0))] || OffLineChargeAction.UNKNOWN;
        this.status = OffLineChargeStatusMapping[String(buffer.readUInt8(1))] || OffLineChargeStatusMapping.UNKNOWN;
    }

    public getAction(): OffLineChargeAction {
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
