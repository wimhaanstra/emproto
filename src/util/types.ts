import Evse from "Evse.js";
import EmDatagram from "dgrams/EmDatagram.js";

export interface EmEvse {
    /**
     * Get information about the EVSE. EVSE does not need to be online or logged in for this.
     */
    getInfo(): EmEvseInfo;

    /**
     * Get currently known EVSE configuration. EVSE does not need to be online or logged in for this.
     */
    getConfig(): EmEvseConfig;

    /**
     * Get live configuration from the EVSE. The EVSE needs to be online and logged in for this.
     * This method is called automatically immediately after a successful login.
     */
    fetchConfig(): Promise<EmEvseConfig>;

    /**
     * Get the last time a datagram was received from the EVSE.
     */
    getLastSeen(): Date;

    /**
     * Whether the EVSE is online. This is determined by how recent getLastSeen is.
     */
    isOnline(): boolean;

    /**
     * Whether the EVSE has a password saved. Since a password is only saved for the EVSE upon successful login,
     * this means the password was (at least at the time of that login) correct.
     */
    hasPassword(): boolean;

    /**
     * Checks a password against the saved password, without checking at the EVSE (use the login method for that).
     * @param password Password to test against the saved password.
     */
    checkPassword(password: string): boolean;

    /**
     * Whether the app is logged in, i.e. has an active session on the EVSE.
     */
    isLoggedIn(): boolean;

    /**
     * Attempt to login using given password. The EVSE needs to be online for this.
     * If the password is correct, it is also saved for the EVSE.
     *
     * @param password Password to use for logging in to the EVSE.
     * @returns Promise which resolves when the login is successful, or rejects otherwise (e.g. password incorrect
     *          or EVSE not responding).
     */
    login(password?: string): Promise<void>;

    /**
     * Get the "lines" of the EVSE, i.e. the connectors. Usually an EVSE will have only one, but the app protocol
     * suggests support for multiple.
     */
    getLines(): Map<number, EmEvseLine>;

    /**
     * Set the EVSE's name. The EVSE needs to be online for this call to work.
     * If the update is successful, the name is also set in EVSE's config.
     * The current (c.q. last known) name can be accessed via getConfig().name.
     *
     * @param name New name to assign to the EVSE.
     * @returns Promise which resolves when the name is successfully set, or rejects otherwise (e.g. invalid name
     *          or EVSE not responding).
     */
    setName(name: string): Promise<void>;

    /**
     * Set whether the EVSE allows charging offline, i.e. without an app. This is usually done via a button or
     * touchpad on the EVSE, and allowing offline charging normally implies that anyone with physical access can
     * start a session, so only enable if the EVSE is on private ground.
     * The EVSE needs to be online for this call to work. If the update is successful, the new status is also
     * set in EVSE's config.
     * The current (c.q. last known) status can be accessed via getConfig().offLineCharge.
     *
     * @param status New offline charging status.
     * @returns Promise which resolves when the status is successfully set, or rejects otherwise (e.g. invalid status
     *          or EVSE not responding).
     */
    setOffLineCharge(status: OffLineChargeStatus): Promise<void>;

    /**
     * Set the EVSE's temperature unit.
     * The EVSE needs to be online for this call to work. If the update is successful, the new unit is also
     * set in EVSE's config.
     * The current (c.q. last known) temperature unit can be accessed via getConfig().temperatureUnit.
     *
     * @param unit New temperature unit to use for the EVSE.
     * @returns Promise which resolves when the temperature unit is successfully set, or rejects otherwise
     *          (e.g. invalid unit or EVSE not responding).
     */
    setTemperatureUnit(unit: TemperatureUnit): Promise<void>;

    /**
     * Set the EVSE's language.
     * The EVSE needs to be online for this call to work. If the update is successful, the new language is also
     * set in EVSE's config.
     * The current (c.q. last known) language can be accessed via getConfig().language.
     *
     * @param language New language to use for the EVSE.
     * @returns Promise which resolves when the language is successfully set, or rejects otherwise (e.g. invalid
     *          language or EVSE not responding).
     */
    setLanguage(language: Language): Promise<void>;

    /**
     * Set the maximum electricity (in amps) the EVSE will deliver. The effective charging current may be
     * lower depending on other factors, such as: the maximum supported by the car's on-board charging circuit;
     * the car's battery state of charge; the car's charging schedule; the battery or EVSE temperature; etc.
     * The EVSE needs to be online for this call to work. If the update is successful, the new value is also
     * set in EVSE's config.
     * The current (c.q. last known) maximum electricity can be accessed via getConfig().maxElectricity.
     *
     * @param amps Maximum current in amps.
     * @returns Promise which resolves when the maximum electricity is successfully set, or rejects otherwise
     *          (e.g. invalid amps value or EVSE not responding).
     */
    setMaxElectricity(amps: number): Promise<void>;

    /**
     * Start charging on given line (plug). The EVSE needs to be online for this call to work.
     *
     * @param params Parameters for starting the charging session. See ChargeStartParams for details.
     * @returns Promise which resolves when the charging session is successfully started, or rejects otherwise
     *          (e.g. invalid amps value or EVSE not responding or invalid EVSE state, like: already charging).
     */
    chargeStart(params: ChargeStartParams): Promise<ChargeStartResult>;

    /**
     * Stop charging on given line (plug). The EVSE needs to be online for this call to work.
     *
     * @param params Parameters for stopping the charging session. See ChargeStopParams for details.
     * @returns Promise which resolves when the charging session is successfully stopped, or rejects otherwise
     *          (e.g. EVSE not responding or invalid EVSE state, like: no active charging session).
     */
    chargeStop(params?: ChargeStopParams): Promise<ChargeStopResult>;

    /**
     * Debug string representation of the EVSE.
     */
    toString(): string;
}

/**
 * Charge start parameters.
 */
export type ChargeStartParams = {
    /**
     * Line (plug, connector) ID to start charging on. This may be omitted if there is only one line (plug) on the
     * EVSE (which is normally the case) - the EVSE will then start charging on that single line.
     */
    lineId?: number;
    /**
     * Maximum current in amps to charge with. The OEM app uses the value obtained from the getOutputElectricity
     * command to get this value, and persists it on the EVSE using the setOutputElectricity command. That command
     * appears to only be used to persist/sync the value between apps (or sessions) and not influence the actual
     * charging current; the EVSE charges with the amps defined here for the charge start.
     */
    maxAmps: number;
    /**
     * Identifier of the charging session. Maximum 16 ASCII characters (truncated if too long).
     * Default if omitted is: current time (even if startAt is set in future) formatted as: yyyyMMddHHmm, plus 4 random
     * trailing numbers (same format is used by the OEM app).
     */
    chargeId?: string;
    /**
     * Identifier of the user starting the session. Maximum 16 ASCII characters (truncated if too long).
     */
    userId?: string;
    /**
     * Date when to start charging. If omitted or in the past, the EVSE will start charging immediately. If the time
     * is in the future, then the EVSE will show a "charging reservation".
     */
    startAt?: Date;
    /**
     * Maximum duration in minutes to charge for. If omitted or zero, there is no duration limit.
     * Maximum value appears to be 65534 minutes.
     */
    maxDurationMinutes?: number;
    /**
     * Maximum energy in kWh to charge. If omitted or zero, there is no energy limit.
     * This value is communicated at protocol level as hundredths of a kWh, so no point specifying it with
     * more than two decimals precision.
     * Maximum value appears to be 655.35 kWh.
     */
    maxEnergyKWh?: number;
};

export type ChargeStartResult = {
    lineId: number;
    reservationResult: number;
    startResult: number;
    errorReason: number;
    maxElectricity: number;
};

export type ChargeStopParams = {
    /**
     * Line (plug, connector) ID to stop charging on. This may be omitted if there is only one line (plug) on the
     * EVSE (which is normally the case) - the EVSE will then stop charging on that single line.
     */
    lineId?: number;
    /**
     * Identifier of the user stopping the session. Maximum 16 ASCII characters (truncated if too long).
     */
    userId?: string;
};

export type ChargeStopResult = {
    lineId: number;
    stopResult: number;
    failReason: number;
}

export type EmCommunicatorConfig = {

    /**
     * UDP port to listen on for incoming EM EVSE datagrams.
     * Default to 28376.
     */
    port: number;

    /**
     * How many seconds after an EVSE's last datagram before considering it offline.
     * EM EVSEs seem to send a datagram every 5 seconds announcing their presence, or once every 10 seconds to keep
     * a login session alive, so we're using 11 seconds as default.,
     */
    offlineAfterLastDatagram: number;

    /**
     * Whether to dump all sent and received datagrams to stdout.
     * Received datagrams are dumped in 2 ways: all raw incoming UDP packet is dumped as hex data (regardless of
     * whether it was recognized and parsed), and if a protocol datagram is recognized by the protocol handler, the
     * (better readable) normalized datagram object parsed from the packet is also dumped.
     */
    dumpDatagrams: boolean;
}

export const DEFAULT_EM_COMMUNICATOR_CONFIG: EmCommunicatorConfig = {
    port: 28376,
    offlineAfterLastDatagram: 11,
    dumpDatagrams: false
};

export const EmEvseEvents = ["added", "changed", "removed", "datagram"] as const;
export type EmEvseEvent = typeof EmEvseEvents[number];
export type EmEvseEventHandler = (evse: Evse, event: EmEvseEvent, datagram?: EmDatagram) => void;

export enum EmEvseGunState {
    UNKNOWN_0 = 0,
    DISCONNECTED = 1,   // Seen live when gun not plugged in.
    CONNECTED_UNLOCKED = 2,  // Seen live when just plugged in but not charging yet (l1Electricity=0, outputState=IDLE, currentState=CHARGING).
    UNKNOWN_3 = 3,  // Probably used when connected but not charging, or when plugging in and negotiating...
    CONNECTED_LOCKED = 4,  // Seen live while charging and car locked.
    UNKNOWN_5 = 5,
    UNKNOWN_6 = 6,
    UNKNOWN_7 = 7,
    UNKNOWN_8 = 8,
    UNKNOWN_OTHER = 254
}

export enum EmEvseOutputState {
    UNKNOWN_0 = 0,
    CHARGING = 1,   // Seen live while charging (auto full charge, the default charge method).
    IDLE = 2, // Seen live when not charging.
    UNKNOWN_3 = 3,
    UNKNOWN_4 = 4,
    UNKNOWN_5 = 5,
    UNKNOWN_6 = 6,
    UNKNOWN_7 = 7,
    UNKNOWN_8 = 8,
    UNKNOWN_OTHER = 254
}

export enum EmEvseCurrentState {
    EVSE_FAULT = 1,
    CHARGING_FAULT_2 = 2,
    CHARGING_FAULT_3 = 3,
    UNKNOWN_4 = 4,
    UNKNOWN_5 = 5,
    UNKNOWN_6 = 6,
    UNKNOWN_7 = 7,
    UNKNOWN_8 = 8,
    UNKNOWN_9 = 9,
    WAITING_FOR_SWIPE = 10,
    WAITING_FOR_BUTTON = 11,
    NOT_CONNECTED = 12,    // Seen live when not charging and gun not plugged in.
    READY_TO_CHARGE = 13, // Seen live when plugged in but no charge started yet (l1Electricity=0, gunState=2/Connecting, outputState=IDLE)
    CHARGING = 14,  // Seen live while charging (auto full charge, single-phase).
    COMPLETED = 15,
    UNKNOWN_16 = 16,
    COMPLETED_FULL_CHARGE = 17,
    UNKNOWN_18 = 18,
    UNKNOWN_19 = 19,
    CHARGING_RESERVATION = 20,
    UNKNOWN_21 = 21,
    UNKNOWN = 254
}

export enum EmEvseErrorState {
    NO_ERROR = 0,
    RELAY_STICK_ERROR = 1,
    METER_ERROR = 2,
    OFFLINE = 3,
    CC_ERROR = 4,
    CP_ERROR = 5,
    EMERGENCY_STOP = 6,
    UNKNOWN_7 = 7,
    OVER_TEMPERATURE = 8,
    UNKNOWN_9 = 9,
    LEAKAGE_PROTECTION = 10,
    SHORT_CIRCUIT = 11,
    OVER_CURRENT = 12,
    UNGROUNDED = 13,
    OVER_VOLTAGE = 14,
    LOW_VOLTAGE = 15,
    DIODE_SHORT_CIRCUIT = 27,
    RTC_FAILURE = 28,
    FLASH_MEMORY_FAILURE = 29,
    EEPROM_FAILURE = 30,
    METERING_MODULE_FAILURE = 31,
    UNKNOWN = 254
}

export type EmEvseInfo = {
    ip: string;
    port: number;
    serial: string;
    brand?: string;
    model?: string;
    hardwareVersion?: string;
    softwareVersion?: string;
    hotLine?: string;
    // The physical maximum power (in watts) the EVSE can deliver. This is maxElectricity times phase voltage
    // times the number of phases.
    maxPower?: number;
    // The physical maximum electricity (in amps) the EVSE can deliver.
    maxElectricity?: number;
    feature?: number;
    supportNew?: number;
};

export function isEmEvseInfo(obj: any): obj is EmEvseInfo {
    return obj && typeof obj.ip === "string" && typeof obj.port === "number" && typeof obj.serial === "string";
}

export type EmEvseConfig = {
    // Configured name.
    name?: string;
    // Configured language.
    language?: Language;
    // Configured temperature unit.
    temperatureUnit?: TemperatureUnit;
    // Whether the EVSE can charge offline, i.e. from a button on the EVSE, without an app.
    offLineCharge?: OffLineChargeStatus;
    // The configured maximum electricity (in amps) the EVSE will deliver.
    // The effective maximum will be the lowest of this and EmEvseInfo.maxElectricity (and the actual charging rate
    // may be lower if the car's onboard charging circuit is configured at a lower value or is throttling, or the
    // car can't physically charge faster).
    maxElectricity?: number;
};

export type EmEvseLine = {
    lineId: number;
    currentPower: number;
    currentAmount: number;
    l1Voltage: number;      // in volts; zero means phase is not connected
    l1Electricity: number;  // in amps
    l2Voltage: number;      // in volts; zero means phase is not connected
    l2Electricity: number;  // in amps
    l3Voltage: number;      // in volts; zero means phase is not connected
    l3Electricity: number;  // in amps
    innerTemp: number;
    outerTemp: number;
    currentState: EmEvseCurrentState;
    gunState: EmEvseGunState;
    outputState: EmEvseOutputState;
    errors: EmEvseErrorState[];
};

export enum OffLineChargeStatusMapping {
    ENABLED = 0,
    DISABLED = 1,
    UNKNOWN_2 = 2, // Seen live when offline charge is disabled (app required to start charging session).
    UNKNOWN_3 = 3,
    UNKNOWN_4 = 4,
    UNKNOWN_5 = 5,
    UNKNOWN = 254
}
export type OffLineChargeStatus = keyof typeof OffLineChargeStatusMapping;

export enum OffLineChargeAction {
    UNKNOWN_0 = 0,
    SET = 1,     // Seen in an unsolicited SetAndGetOffLineChargeResponse(269) with a status of 2 when offline charging was disabled.
    GET = 2,
    UNKNOWN_3 = 3,
    UNKNOWN_4 = 4,
    UNKNOWN_5 = 5,
    UNKNOWN = 254
}

export enum SystemTimeAction {
    GET = 0,    // Seen in an unsolicited SettingSystemTime when the evse is reporting its time. Since other calls have actions SET=1 and GET=2, perhaps this means REPORT=0 for unsolicited reports? Need to test an explicit GET.
    SET = 1,
    UNKNOWN_2 = 2,
    UNKNOWN_3 = 3,
    UNKNOWN_4 = 4,
    UNKNOWN_5 = 5,
    UNKNOWN = 254
}

export enum SetAndGetOutputElectricityAction {
    UNKNOWN_0 = 0,
    SET = 1,    // Note: not yet seen.
    GET = 2,    // Note: not yet seen.
    UNKNOWN_3 = 3,
    UNKNOWN_4 = 4,
    UNKNOWN_5 = 5,
    UNKNOWN = 254
}

export enum SetAndGetNickNameAction {
    SET = 1,
    GET = 2,
    UNKNOWN = 254
}

export enum SetAndGetTemperatureUnitAction {
    SET = 1,
    GET = 2,
    UNKNOWN = 254
}

export enum TemperatureUnitMapping {
    CELSIUS = 1,
    FAHRENHEIT = 2,
    UNKNOWN = 254,
}
export type TemperatureUnit = keyof typeof TemperatureUnitMapping;

export enum SetAndGetLanguageAction {
    UNKNOWN_0 = 0,
    SET = 1,
    GET = 2,
    UNKNOWN_3 = 3,
    UNKNOWN_4 = 4,
    UNKNOWN_5 = 5,
    UNKNOWN = 254
}

export enum LanguageMapping {
    UNKNOWN_0 = 0,
    ENGLISH = 1,
    ITALIAN = 2,
    GERMAN = 3,
    FRENCH = 4,
    SPANISH = 5,
    HEBREW = 6,
    UNKNOWN_7 = 7,
    UNKNOWN_8 = 8,
    UNKNOWN_9 = 9,
    UNKNOWN_10 = 10,
    UNKNOWN = 254
}
export type Language = keyof typeof LanguageMapping;

export type DispatchEvent = (event: EmEvseEvent, evse: Evse, datagram?: EmDatagram) => void;
