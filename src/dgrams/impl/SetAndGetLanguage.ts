import Datagram from "../Datagram";
import { type Language, LanguageMapping, SetAndGetLanguageAction } from "../../util/types";
import { enumStr } from "../../util/util";

abstract class SetAndGetLanguageAbstract extends Datagram {

    private _action: SetAndGetLanguageAction = SetAndGetLanguageAction.GET;
    private _language: LanguageMapping = LanguageMapping.UNKNOWN;

    public get action(): SetAndGetLanguageAction {
        return this._action;
    }

    public setAction(action: SetAndGetLanguageAction): this {
        this._action = action;
        return this;
    }

    public get language(): Language {
        return enumStr(this._language, LanguageMapping) as Language;
    }

    public setLanguage(language: Language): this {
        this._language = LanguageMapping[language];
        return this;
    }

    protected packPayload(): Buffer {
        if (this._action === SetAndGetLanguageAction.SET && !this._language) {
            throw new Error('Language is required when setting');
        }

        return Buffer.of(this._action, this._language);
    }

    protected unpackPayload(buffer: Buffer): void {
        this._action = buffer.readUInt8(0) as SetAndGetLanguageAction || SetAndGetLanguageAction.UNKNOWN;
        this._language = buffer.readUInt8(1) as LanguageMapping || LanguageMapping.UNKNOWN;
    }

}

export class SetAndGetLanguage extends SetAndGetLanguageAbstract {
    public static readonly COMMAND = 33039;
}

export class SetAndGetLanguageResponse extends SetAndGetLanguageAbstract {
    public static readonly COMMAND = 271;
}
