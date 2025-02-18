import { Buffer } from "node:buffer";
import Datagram from "./Datagram";
import NotEmDatagramError from "../errors/NotEmDatagramError";

import { Login, LoginResponse, RequestLogin, LoginConfirm } from "./impl/Login";
import { Heading, HeadingResponse } from "./impl/Heading";
import { PasswordErrorResponse } from "./impl/PasswordErrorResponse";
import { SingleACStatus, SingleACStatusResponse } from "./impl/SingleACStatus";
import { ChargeStart, ChargeStartResponse } from "./impl/ChargeStart";
import { ChargeStop, ChargeStopResponse } from "./impl/ChargeStop";
import { SetAndGetAlarmChargeStrategyResponse } from "./impl/SetAndGetAlarmChargeStrategyResponse";
import { SingleACChargingStatusPublicAuto, SingleACChargingStatusResponse } from "./impl/SingleACChargingStatus";
import { RequestStatusRecord } from "./impl/RequestStatusRecord";
import { SetAndGetChargeFeeResponse } from "./impl/SetAndGetChargeFeeResponse";
import { SetAndGetServiceFeeResponse } from "./impl/SetAndGetServiceFeeResponse";
import { SetAndGetNickName, SetAndGetNickNameResponse } from "./impl/SetAndGetNickName";
import { SetAndGetTemperatureUnit, SetAndGetTemperatureUnitResponse } from "./impl/SetAndGetTemperatureUnit";
import { SetAndGetOutputElectricity, SetAndGetOutputElectricityResponse } from "./impl/SetAndGetOutputElectricity";
import { SetAndGetOffLineCharge, SetAndGetOffLineChargeResponse } from "./impl/SetAndGetOffLineCharge";
import { SetAndGetLanguage, SetAndGetLanguageResponse } from "./impl/SetAndGetLanguage";
import { SetAndGetSystemTime, SetAndGetSystemTimeResponse } from "./impl/SetAndGetSystemTime";
import { GetVersion, GetVersionResponse } from "./impl/GetVersion";
import { UploadLocalChargeRecord } from "./impl/UploadLocalChargeRecord";
import {
    CurrentChargeRecord,
    CurrentChargeRecordResponse,
    RequestChargeStatusRecord
} from "./impl/CurrentChargeRecord";

// Register implementations here.
const emDatagramTypes = [
    ChargeStart,
    ChargeStartResponse,
    ChargeStop,
    ChargeStopResponse,
    RequestChargeStatusRecord,
    CurrentChargeRecord,
    CurrentChargeRecordResponse,
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
    SetAndGetSystemTime,
    SetAndGetSystemTimeResponse,
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
}, new Map<number, typeof Datagram>());

export function parseDatagrams(buffer: Buffer): Datagram[] {
    const datagrams: Datagram[] = [];
    while (buffer.length >= 25) {
        // We only do the simple length and header check here, so we can read the command number.
        // Further checks are done when unpacking the specific implementation.
        if (buffer.readUInt16BE(0) !== Datagram.PACKET_HEADER) {
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
