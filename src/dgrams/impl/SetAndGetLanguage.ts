import Datagram from "../Datagram.js";
import { type Language, LanguageMapping, SetAndGetLanguageAction } from "../../util/types.js";
import { enumStr } from "../../util/util.js";

abstract class SetAndGetLanguageAbstract extends Datagram {

    private action: SetAndGetLanguageAction = SetAndGetLanguageAction.GET;

    private language: LanguageMapping;

    public getAction(): SetAndGetLanguageAction {
        return this.action;
    }

    public setAction(action: SetAndGetLanguageAction): this {
        this.action = action;
        return this;
    }

    public getLanguage(): Language {
        return enumStr(this.language, LanguageMapping) as Language;
    }

    public setLanguage(language: Language): this {
        this.language = LanguageMapping[language];
        return this;
    }

    protected packPayload(): Buffer {
        if (this.action === SetAndGetLanguageAction.SET && !this.language) {
            throw new Error('Language is required when setting');
        }

        return Buffer.of(this.action, this.language);
    }

    protected unpackPayload(buffer: Buffer): void {
        this.action = SetAndGetLanguageAction[String(buffer.readUInt8(0))] || SetAndGetLanguageAction.UNKNOWN;
        this.language = LanguageMapping[String(buffer.readUInt8(1))] || LanguageMapping.UNKNOWN;
    }

}

export class SetAndGetLanguage extends SetAndGetLanguageAbstract {
    public static readonly COMMAND = 33039;
}

export class SetAndGetLanguageResponse extends SetAndGetLanguageAbstract {
    public static readonly COMMAND = 271;
}
