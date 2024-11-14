import { Buffer } from "node:buffer";
import EmDatagram from "./EmDatagram.js";
import NotEmDatagramError from "../errors/NotEmDatagramError.js";

import { Login, LoginResponse, RequestLogin, LoginConfirm } from "./impl/Login.js";
import { Heading, HeadingResponse } from "./impl/Heading.js";
import { PasswordErrorResponse } from "./impl/PasswordErrorResponse.js";
import { SingleACStatus, SingleACStatusResponse } from "./impl/SingleACStatus.js";
import { ChargeStart, ChargeStartResponse } from "./impl/ChargeStart.js";
import { ChargeStop, ChargeStopResponse } from "./impl/ChargeStop.js";
import { SetAndGetAlarmChargeStrategyResponse } from "./impl/SetAndGetAlarmChargeStrategyResponse.js";
import { SettingSystemTime } from "./impl/SystemTime.js";
import { SingleACChargingStatusPublicAuto } from "./impl/SingleACChargingStatusPublicAuto.js";
import { RequestStatusRecord } from "./impl/RequestStatusRecord.js";
import { SingleACChargingStatusResponse } from "./impl/SingleACChargingStatusResponse.js";
import { SetAndGetChargeFeeResponse } from "./impl/SetAndGetChargeFeeResponse.js";
import { SetAndGetServiceFeeResponse } from "./impl/SetAndGetServiceFeeResponse.js";
import { SetAndGetNickName, SetAndGetNickNameResponse } from "./impl/SetAndGetNickName.js";
import { SetAndGetTemperatureUnit, SetAndGetTemperatureUnitResponse } from "./impl/SetAndGetTemperatureUnit.js";
import { SetAndGetOutputElectricity, SetAndGetOutputElectricityResponse } from "./impl/SetAndGetOutputElectricity.js";
import { SetAndGetOffLineCharge, SetAndGetOffLineChargeResponse } from "./impl/SetAndGetOffLineCharge.js";
import { SetAndGetLanguage, SetAndGetLanguageResponse } from "./impl/SetAndGetLanguage.js";
import { GetVersion, GetVersionResponse } from "./impl/GetVersion.js";
import { UploadLocalChargeRecord } from "./impl/UploadLocalChargeRecord.js";

// Register implementations here.
const emDatagramTypes = [
    ChargeStart,
    ChargeStartResponse,
    ChargeStop,
    ChargeStopResponse,
    GetVersion,
    GetVersionResponse,
    Heading,
    HeadingResponse,
    Login,
    LoginConfirm,
    LoginResponse,
    RequestLogin,
    PasswordErrorResponse,
    RequestStatusRecord,
    SetAndGetAlarmChargeStrategyResponse,
    SetAndGetChargeFeeResponse,
    SetAndGetLanguage,
    SetAndGetLanguageResponse,
    SetAndGetNickName,
    SetAndGetNickNameResponse,
    SetAndGetOffLineCharge,
    SetAndGetOffLineChargeResponse,
    SetAndGetOutputElectricity,
    SetAndGetOutputElectricityResponse,
    SetAndGetTemperatureUnit,
    SetAndGetTemperatureUnitResponse,
    SetAndGetServiceFeeResponse,
    SettingSystemTime,
    SingleACChargingStatusPublicAuto,
    SingleACChargingStatusResponse,
    SingleACStatus,
    SingleACStatusResponse,
    UploadLocalChargeRecord
];

// Store implementations by command number in a map and validate that all implementations have a unique nonzero command number.
const emDatagramTypesByCommand = emDatagramTypes.reduce((acc, emDatagramType) => {
    const existing = acc.get(emDatagramType.COMMAND);
    if (existing) {
        throw new Error(`Invalid EmDatagram ${emDatagramType.name}: duplicate command number ${emDatagramType.COMMAND} also in use by ${existing.name}`);
    }
    return acc.set(emDatagramType.COMMAND, emDatagramType);
}, new Map<number, typeof EmDatagram>());

export function parseDatagrams(buffer: Buffer): EmDatagram[] {
    const datagrams: EmDatagram[] = [];
    while (buffer.length >= 25) {
        // We only do the simple length and header check here, so we can read the command number.
        // Further checks are done when unpacking the specific implementation.
        if (buffer.readUInt16BE(0) !== EmDatagram.PACKET_HEADER) {
            throw new NotEmDatagramError("Missing magic header for packet: " + buffer.toString("hex"));
        }

        const command = buffer.readUInt16BE(19);
        const emDatagramType = emDatagramTypesByCommand.get(command);
        if (!emDatagramType) {
            console.warn(`Invalid EmDatagram: unknown command ${command}`);
            break;
        }
        // @ts-ignore
        const datagram = new emDatagramType();
        const datagramLength = datagram.unpack(buffer);
        datagrams.push(datagram);
        buffer = buffer.subarray(datagramLength);
    }
    return datagrams;
}
