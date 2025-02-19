import { clearTimeout } from "node:timers";
import { Communicator } from "./Communicator";
import Datagram from "./dgrams/Datagram";
import {
    ChargeStartParams,
    ChargeStartResult,
    ChargeStopParams,
    ChargeStopResult,
    type DispatchEvent,
    type EmEvseConfig,
    EmEvseCurrentCharge,
    type EmEvseEvent,
    EmEvseGunState,
    type EmEvseInfo,
    EmEvseMetaState,
    EmEvseOutputState,
    type EmEvseState,
    isEmEvseInfo,
    type Language,
    OffLineChargeAction,
    OffLineChargeStatus,
    Phases,
    SetAndGetLanguageAction,
    SetAndGetNickNameAction,
    SetAndGetOutputElectricityAction,
    SetAndGetTemperatureUnitAction, SystemTimeAction,
    TemperatureUnit
} from "./util/types";
import {
    decodePassword,
    encodePassword,
    enumEquals,
    logError,
    logInfo,
    logWarning,
    toDate,
    update
} from "./util/util";
import { LoginAbstract, LoginConfirm, LoginResponse, RequestLogin } from "./dgrams/impl/Login";
import { SingleACStatus } from "./dgrams/impl/SingleACStatus";
import { SetAndGetNickName, SetAndGetNickNameResponse } from "./dgrams/impl/SetAndGetNickName";
import { SetAndGetTemperatureUnit, SetAndGetTemperatureUnitResponse } from "./dgrams/impl/SetAndGetTemperatureUnit";
import {
    SetAndGetOutputElectricity,
    SetAndGetOutputElectricityResponse
} from "./dgrams/impl/SetAndGetOutputElectricity";
import { SetAndGetOffLineCharge, SetAndGetOffLineChargeResponse } from "./dgrams/impl/SetAndGetOffLineCharge";
import { SetAndGetLanguage, SetAndGetLanguageResponse } from "./dgrams/impl/SetAndGetLanguage";
import { GetVersion, GetVersionResponse } from "./dgrams/impl/GetVersion";
import { HeadingResponse } from "./dgrams/impl/Heading";
import { PasswordErrorResponse } from "./dgrams/impl/PasswordErrorResponse";
import { ChargeStart, ChargeStartResponse } from "./dgrams/impl/ChargeStart";
import { ChargeStop, ChargeStopResponse } from "./dgrams/impl/ChargeStop";
import { ChargeStartError, successReservationResults } from "./errors/ChargeStartError";
import { SingleACChargingStatus } from "./dgrams/impl/SingleACChargingStatus";
import { SetAndGetSystemTime, SetAndGetSystemTimeResponse } from "./dgrams/impl/SetAndGetSystemTime";

export default class Evse {

    private readonly communicator: Communicator;
    private readonly dispatchEvent: (event: EmEvseEvent, datagram?: Datagram) => void;

    private readonly _info: EmEvseInfo;
    private _config: EmEvseConfig;
    private _lastSeen?: Date;
    private _lastActiveLogin: Date | undefined = undefined;
    private _lastConfigUpdate: Date | undefined;
    private _online: boolean;
    private _password: string | undefined;
    private _state: EmEvseState | undefined;
    private _currentCharge?: EmEvseCurrentCharge;
    private _configUpdatePromise?: Promise<any>;

    public onError?: (command?: number) => void;

    constructor(communicator: Communicator,
        dispatchEvent: DispatchEvent,
        info: EmEvseInfo | { info: object, config?: object, lastSeen?: Date | number | string, lastConfigUpdate?: Date | number | string }) {
        this.communicator = communicator;
        this.dispatchEvent = (event: EmEvseEvent, datagram?: Datagram) => dispatchEvent(event, this, datagram);

        if (isEmEvseInfo(info)) {
            // Creating new discovered EVSE.
            this._info = { ...info };
            this._config = {};
            this._lastSeen = new Date();
            this._online = true;
        } else {
            // Loading EVSE from persistent storage.
            if (!isEmEvseInfo(info.info)) {
                throw new Error("Invalid EmEvseInfo in EmEvse constructor: " + JSON.stringify(info.info));
            }
            this._info = { ...info.info };
            this._config = info.config ? { ...info.config } : {};
            this._online = false;
            this._lastSeen = toDate(info.lastSeen);
            this._lastConfigUpdate = toDate(info.lastConfigUpdate);
            this.updateOnlineStatus();
        }
    }

    public get info(): EmEvseInfo {
        return this._info;
    }

    public get config(): EmEvseConfig {
        return this._config;
    }

    public get label() {
        const name = this.config?.name;
        if (name) return name;
        const brandAndModel = [this.info.brand, this.info.model].filter(Boolean).join(" ");
        if (brandAndModel !== "") return brandAndModel;
        return this.info.serial;
    }

    public get lastSeen(): Date | undefined {
        return this._lastSeen;
    }

    public get lastConfigUpdate(): Date | undefined {
        return this._lastConfigUpdate;
    }

    public isOnline(): boolean {
        return this._online;
    }

    public isLoggedIn(): boolean {
        return this.isOnline()
            && this._lastActiveLogin !== undefined
            && this._lastActiveLogin.getTime() > (Date.now() - (1000 * 15));
    }

    public hasPassword(): boolean {
        return this._password !== undefined;
    }

    public checkPassword(password: string) {
        return this._password && this._password === password;
    }

    public get state(): EmEvseState | undefined {
        if (!this.isLoggedIn()) return undefined;
        return this._state;
    }

    public get metaState(): EmEvseMetaState {
        if (!this.isOnline()) return EmEvseMetaState.OFFLINE;
        if (!this.isLoggedIn()) return EmEvseMetaState.NOT_LOGGED_IN;
        if (!this._state) return EmEvseMetaState.IDLE;
        if (this._state.errors?.length > 0) return EmEvseMetaState.ERROR;
        if (enumEquals(this._state.outputState, EmEvseOutputState.CHARGING, EmEvseOutputState)) return EmEvseMetaState.CHARGING;
        if (!enumEquals(this._state.gunState, EmEvseGunState.DISCONNECTED, EmEvseGunState)) return EmEvseMetaState.PLUGGED_IN;
        return EmEvseMetaState.IDLE;
    }

    public get currentCharge(): EmEvseCurrentCharge | undefined {
        return this._currentCharge;
    }

    public sendDatagram(datagram: Datagram): Promise<number> {
        if (datagram instanceof HeadingResponse) {
            this._lastActiveLogin = new Date();
            // lastActiveLogin is transient, so no changed event necessary. We need to re-login
            // anyway after an app restart.
        }

        try {
            return this.communicator.send(datagram, this);
        } catch (error) {
            const command = datagram.getCommand();

            if (this.onError) {
                this.onError(command);
            }
        }
    }

    public updateIp(ip: string, port: number): boolean {
        this._lastSeen = new Date();
        let changed = false;

        if (this.updateOnlineStatus()) {
            changed = true;
        }

        if (ip !== this._info.ip) {
            this._info.ip = ip;
            changed = true;
        }

        if (port !== this._info.port) {
            this._info.port = port;
            changed = true;
        }

        return changed;
    }

    public updateOnlineStatus(): boolean {
        const now = Math.floor(new Date().getTime() / 1000);
        const lastSeen = this._lastSeen ? Math.floor(this._lastSeen.getTime() / 1000) : 0;
        const onlineNow = lastSeen > now - this.communicator.config.offlineAfterLastDatagram;

        if (onlineNow !== this._online) {
            this._online = onlineNow;
            return true;
        }

        return false;
    }

    public update(datagram: Datagram): boolean {
        if (datagram instanceof LoginAbstract) {
            return this.updateLogin(datagram);
        }
        if (datagram instanceof SingleACStatus) {
            return this.updateSingleAcStatus(datagram);
        }
        if (datagram instanceof SingleACChargingStatus) {
            return this.updateChargingStatus(datagram)
        }
        if (datagram instanceof SetAndGetOffLineChargeResponse) {
            return this.updateOfflineCharging(datagram);
        }
        if (datagram instanceof SetAndGetOutputElectricityResponse) {
            return this.updateOutputElectricity(datagram);
        }
        if (datagram instanceof SetAndGetNickNameResponse) {
            return this.updateNickName(datagram);
        }
        if (datagram instanceof SetAndGetTemperatureUnitResponse) {
            return this.updateTemperatureUnit(datagram);
        }
        if (datagram instanceof SetAndGetLanguageResponse) {
            return this.updateLanguage(datagram);
        }
        if (datagram instanceof GetVersionResponse) {
            return this.updateVersion(datagram);
        }
        if (datagram instanceof PasswordErrorResponse) {
            return this.updatePasswordError(datagram);
        }
        return false;
    }

    private updateLogin(login: LoginAbstract): boolean {
        // Guard against accidental processing of datagrams from other devices.
        if (this._info.serial !== login.serial) {
            return false;
        }

        this._lastSeen = new Date();
        let changed = this.updateOnlineStatus();

        if (this._info.brand !== login.brand) {
            this._info.brand = login.brand;
            changed = true;
        }

        if (this._info.model !== login.model) {
            this._info.model = login.model;
            changed = true;
        }

        if (this._info.hardwareVersion !== login.hardwareVersion) {
            this._info.hardwareVersion = login.hardwareVersion;
            changed = true;
        }

        if (this._info.maxPower !== login.maxPower) {
            this._info.maxPower = login.maxPower;
            changed = true;
        }

        if (this._info.maxElectricity !== login.maxElectricity) {
            this._info.maxElectricity = login.maxElectricity;
            changed = true;
        }

        if (this._info.hotLine !== login.hotLine) {
            this._info.hotLine = login.hotLine;
            changed = true;
        }

        const loginType = login.type;
        if (loginType) {
            const phases = [10, 11, 12, 13, 14, 15, 22, 23, 24, 25].includes(loginType) ? Phases.THREE_PHASE : Phases.SINGLE_PHASE;
            if (this._info.phases !== phases) {
                this._info.phases = phases;
                changed = true;
            }
        }

        return changed;
    }

    private updateSingleAcStatus(datagram: SingleACStatus): boolean {
        let changed = this._state === undefined;
        if (!this._state) this._state = {} as EmEvseState;

        const currentPower = datagram.currentPower ?? 0;


        if (datagram.l1Voltage && datagram.l2Voltage && datagram.l3Voltage && datagram.l1Electricity && datagram.l2Electricity && datagram.l3Electricity) { // Three phases
            const total = (datagram.l1Voltage * datagram.l1Electricity) + (datagram.l2Voltage * datagram.l2Electricity) + (datagram.l3Voltage * datagram.l3Electricity)

            if (update(this._state, "currentPower", Math.max(total, currentPower))) changed = true;
        } else if (datagram.l1Voltage && datagram.l1Electricity) { // Single phase
            const total = (datagram.l1Voltage * datagram.l1Electricity)
            if (update(this._state, "currentPower", Math.max(total, currentPower))) changed = true;
        } else { // No phases?
            if (update(this._state, "currentPower", currentPower)) changed = true;
        }

        if (update(this._state, "currentPower", currentPower)) changed = true;
        if (update(this._state, "currentAmount", datagram.totalKWhCounter)) changed = true;
        if (update(this._state, "l1Voltage", datagram.l1Voltage)) changed = true;
        if (update(this._state, "l1Electricity", datagram.l1Electricity)) changed = true;
        if (update(this._state, "l2Voltage", datagram.l2Voltage)) changed = true;
        if (update(this._state, "l2Electricity", datagram.l2Electricity)) changed = true;
        if (update(this._state, "l3Voltage", datagram.l3Voltage)) changed = true;
        if (update(this._state, "l3Electricity", datagram.l3Electricity)) changed = true;
        if (update(this._state, "innerTemp", datagram.innerTemp)) changed = true;
        if (update(this._state, "outerTemp", datagram.outerTemp)) changed = true;
        if (update(this._state, "currentState", datagram.currentState)) changed = true;
        if (update(this._state, "gunState", datagram.gunState)) changed = true;
        if (update(this._state, "outputState", datagram.outputState)) changed = true;
        if (update(this._state, "errors", datagram.errors)) changed = true;
        return changed;
    }

    private updateChargingStatus(datagram: SingleACChargingStatus) {
        let changed = this._currentCharge === undefined;
        if (!this._currentCharge) this._currentCharge = {} as EmEvseCurrentCharge;
        if (update(this._currentCharge, "port", datagram.port)) changed = true;
        if (update(this._currentCharge, "currentState", datagram.currentState)) changed = true;
        if (update(this._currentCharge, "chargeId", datagram.chargeId)) changed = true;
        if (update(this._currentCharge, "startType", datagram.startType)) changed = true;
        if (update(this._currentCharge, "chargeType", datagram.chargeType)) changed = true;
        if (update(this._currentCharge, "maxDurationMinutes", datagram.maxDurationMinutes)) changed = true;
        if (update(this._currentCharge, "maxEnergyKWh", datagram.maxEnergyKWh)) changed = true;
        if (update(this._currentCharge, "reservationDate", datagram.reservationDate)) changed = true;
        if (update(this._currentCharge, "userId", datagram.userId)) changed = true;
        if (update(this._currentCharge, "maxElectricity", datagram.maxElectricity)) changed = true;
        if (update(this._currentCharge, "startDate", datagram.startDate)) changed = true;
        if (update(this._currentCharge, "durationSeconds", datagram.durationSeconds)) changed = true;
        if (update(this._currentCharge, "startKWhCounter", datagram.startKWhCounter)) changed = true;
        if (update(this._currentCharge, "currentKWhCounter", datagram.currentKWhCounter)) changed = true;
        if (update(this._currentCharge, "chargeKWh", datagram.chargeKWh)) changed = true;
        if (update(this._currentCharge, "chargePrice", datagram.chargePrice)) changed = true;
        if (update(this._currentCharge, "feeType", datagram.feeType)) changed = true;
        if (update(this._currentCharge, "chargeFee", datagram.chargeFee)) changed = true;
        return changed;
    }


    /**
     * Serialize this EmEvse to a plain object.
     * @returns Plain object representing this EmEvse.
     */
    public serialize(): object {
        return {
            info: this._info,
            config: this._config,
            lastConfigUpdate: this._lastConfigUpdate ? Math.floor(this._lastConfigUpdate.getTime() / 1000) : undefined,
            lastSeen: this._lastSeen ? Math.floor(this._lastSeen.getTime() / 1000) : undefined,
            password: encodePassword(this._password)
        };
    }

    /**
     * Deserialize an EmEvse from a plain object.
     * @param communicator EmCommunicator instance to associate with the deserialized EmEvse.
     * @param dispatchEvent Function to dispatch events via the communicator.
     * @param data Plain object to deserialize.
     * @returns Deserialized EmEvse instance, or undefined if the plain object cannot be deserialized to a valid EmEvse.
     */
    public static deserialize(communicator: Communicator, dispatchEvent: DispatchEvent, data: any): Evse | undefined {
        if (typeof data === "string") {
            data = JSON.parse(data);
        }
        if (typeof data !== "object") {
            logWarning(`Evse.deserialize: data is not an object but a ${typeof data}: ${JSON.stringify(data)}`);
            return undefined;
        }

        if (!isEmEvseInfo(data.info)) {
            logWarning('Evse.deserialize: data.info is not an EmEvseInfo: ${JSON.stringify(data)}')
            return undefined;
        }

        const evse = new Evse(
            communicator,
            dispatchEvent,
            data
        );

        if (typeof data.password === "string") evse._password = decodePassword(data.password);

        return evse;
    }

    /**
     * Merge fields of other EmEvse into this instance.
     * @param other Other EmEvse whose fields to merge into this instance.
     * @returns True if any fields on this instance were changed, false if no fields were changed.
     */
    public merge(other: Evse): boolean {
        if (this._info.serial !== other._info.serial) {
            return false;
        }

        let changed = false;

        if (other._password && (!this._password || other._password !== this._password)) {
            this._password = other._password;
            changed = true;
        }

        if (other._lastSeen && (!this._lastSeen || other._lastSeen > this._lastSeen)) {
            this._lastSeen = other._lastSeen;
            changed = true;
        }

        if (this.updateOnlineStatus()) {
            changed = true;
        }

        if (other._info.ip && (!this._info.ip || other._info.ip !== this._info.ip)) {
            this._info.ip = other._info.ip;
            changed = true;
        }

        if (other._info.port && (!this._info.port || other._info.port !== this._info.port)) {
            this._info.port = other._info.port;
            changed = true;
        }

        if (other._info.brand && (!this._info.brand || other._info.brand !== this._info.brand)) {
            this._info.brand = other._info.brand;
            changed = true;
        }

        if (other._info.model && (!this._info.model || other._info.model !== this._info.model)) {
            this._info.model = other._info.model;
            changed = true;
        }

        if (other._info.hardwareVersion && (!this._info.hardwareVersion || other._info.hardwareVersion !== this._info.hardwareVersion)) {
            this._info.hardwareVersion = other._info.hardwareVersion;
            changed = true;
        }

        if (other._info.softwareVersion && (!this._info.softwareVersion || other._info.softwareVersion !== this._info.softwareVersion)) {
            this._info.softwareVersion = other._info.softwareVersion;
            changed = true;
        }

        if (other._info.hotLine && (!this._info.hotLine || other._info.hotLine !== this._info.hotLine)) {
            this._info.hotLine = other._info.hotLine;
            changed = true;
        }

        if (other._info.maxPower && (!this._info.maxPower || other._info.maxPower !== this._info.maxPower)) {
            this._info.maxPower = other._info.maxPower;
            changed = true;
        }

        if (other._info.maxElectricity && (!this._info.maxElectricity || other._info.maxElectricity !== this._info.maxElectricity)) {
            this._info.maxElectricity = other._info.maxElectricity;
            changed = true;
        }

        if (other._info.feature !== undefined && other._info.feature !== this._info.feature) {
            this._info.feature = other._info.feature;
            changed = true;
        }

        if (other._info.supportNew !== undefined && other._info.supportNew !== this._info.supportNew) {
            this._info.supportNew = other._info.supportNew;
            changed = true;
        }

        if (other._info.phases !== undefined && other._info.phases !== this._info.phases) {
            this._info.phases = other._info.phases;
            changed = true;
        }

        if (other._config.name && (!this._config.name || other._config.name !== this._config.name)) {
            this._config.name = other._config.name;
            changed = true;
        }

        this._config = { ... this._config, ...other._config };

        return changed;
    }

    public async waitForResponse(command: number | number[], timeoutMillis: number): Promise<Datagram> {
        if (typeof command === "number") command = [command];
        return new Promise((resolve, reject) => {
            let timeout: NodeJS.Timeout;
            const listener = (evse: Evse, event: EmEvseEvent, datagram?: Datagram) => {
                if (datagram && evse._info.serial === this._info.serial && command.includes(datagram.getCommand())) {
                    clearTimeout(timeout);
                    this.communicator.removeEventListener("datagram", listener);
                    resolve(datagram);
                }
            };
            this.communicator.addEventListener("datagram", listener);
            timeout = setTimeout(() => {
                this.communicator.removeEventListener("datagram", listener);
                reject(new Error(`Timeout (${timeoutMillis} ms) waiting for response with command ${command}`));
            }, timeoutMillis);
        });
    }

    public async login(password?: string) {
        if (password === undefined && !this.hasPassword()) {
            throw new Error("No saved password to use for login");
        }
        // 1. Send the RequestLogin datagram, explicitly using the specified password. Without an
        // explicit password on the datagram, sendDatagram will fill the existing EVSE password (which
        // will also happen if no password is passed here).
        await this.sendDatagram(new RequestLogin().setPassword(password));
        // 2. Wait for the EVSE to reply with a LoginResponse (correct password)
        // or a PasswordErrorResponse (invalid password).
        const response = await this.waitForResponse([LoginResponse.COMMAND, PasswordErrorResponse.COMMAND], 3000);
        if (response instanceof PasswordErrorResponse) {
            throw new Error("Invalid password");
        }
        // 3. If we get the LoginResponse then the password was correct, so set it on this instance.
        if (password !== undefined && this._password !== password) {
            this._password = password;
            this.dispatchEvent("changed", response);
        }
        // 4. Send the LoginConfirm, completing the login flow. After this the EVSE can take commands.
        await this.sendDatagram(new LoginConfirm().setPassword(password));
        // 5. Mark this evse as having an active session.
        this._lastActiveLogin = new Date();
        // 6. Request EVSE's configuration. We don't need to wait for this; the login is complete.
        this.fetchConfig().catch(error => {
            logError(`Failed to get configuration for ${this._info.serial} after login: ${error.message}`);
        });
    }

    /**
     * Fetch current configuration from EVSE. The EVSE needs to be online and logged in for this.
     * Optionally, if the configuration was fetched recently (within orCachedUntilSeconds), the currently known
     * configuration is returned without fetching it again.
     * @param orCachedUntilSeconds If the configuration was recently fetched (within the last specified
     *                             number of seconds), then return the current config without fetching
     *                             from the EVSE again.
     */
    public async fetchConfig(orCachedUntilSeconds: number = 5): Promise<EmEvseConfig> {
        // If we're already busy getting the configuration, then recycle that promise.
        if (this._configUpdatePromise === undefined) {
            if (this._lastConfigUpdate && this._lastConfigUpdate.getTime() > (Date.now() - (orCachedUntilSeconds * 1000))) {
                return this._config;
            }
            // Set up the receivers for the configuration datagrams. We do this before sending out the
            // requests to avoid missing any responses for earlier requests while we're still busy
            // sending out the later requests.
            this._configUpdatePromise = Promise.all([
                this.waitForResponse(SetAndGetNickNameResponse.COMMAND, 6000),
                this.waitForResponse(SetAndGetLanguageResponse.COMMAND, 6000),
                this.waitForResponse(SetAndGetOffLineChargeResponse.COMMAND, 6000),
                this.waitForResponse(SetAndGetTemperatureUnitResponse.COMMAND, 6000),
                this.waitForResponse(SetAndGetOutputElectricityResponse.COMMAND, 6000),
                this.waitForResponse(GetVersionResponse.COMMAND, 6000)
            ]);

            // Send the datagrams. We don't wait for each one to be flushed to the network.
            this.sendDatagram(new SetAndGetNickName().setAction(SetAndGetNickNameAction.GET)).then();
            this.sendDatagram(new SetAndGetLanguage().setAction(SetAndGetLanguageAction.GET)).then();
            this.sendDatagram(new SetAndGetOffLineCharge().setAction(OffLineChargeAction.GET)).then();
            this.sendDatagram(new SetAndGetOutputElectricity().setAction(SetAndGetOutputElectricityAction.GET)).then();
            this.sendDatagram(new SetAndGetTemperatureUnit().setAction(SetAndGetTemperatureUnitAction.GET)).then();
            this.sendDatagram(new GetVersion()).then();
            logInfo(`Fetching config for ${this.toString()}`);
        }

        // Wait until all responses are in. If some responses are lost, this composite promise will fail
        // due to one of the underlying promises timing out.
        try {
            await this._configUpdatePromise;
        } finally {
            this._configUpdatePromise = undefined;
        }

        // If we get here then all configuration was received (and EVSE changed events were sent). We
        // only mark the time that configuration was last updated, so we can know later on if we need
        // to refresh.
        this._lastConfigUpdate = new Date();
        this.dispatchEvent("changed");
        return this._config;
    }

    public setDatagramPassword(datagram: Datagram) {
        if (this._password !== undefined) {
            datagram.setPassword(this._password);
            return true;
        }
        return false;
    }

    public toString(): string {
        const model = [this._info.brand, this._info.model].filter(Boolean).join(" ");
        return `[${this._info.serial}${model ? " " + model : ""} @ ${this._info.ip} ${EmEvseMetaState[this.metaState]}]`;
    }

    private updateOfflineCharging(datagram: SetAndGetOffLineChargeResponse) {
        if (this._config.offLineCharge !== datagram.status) {
            this._config.offLineCharge = datagram.status;
            return true;
        }
        return false;
    }

    private updateNickName(datagram: SetAndGetNickNameResponse) {
        if (!datagram.nickName) return false;
        if (datagram.nickName !== this._config.name) {
            this._config.name = datagram.nickName;
            return true;
        }
        return false;
    }

    private updateTemperatureUnit(datagram: SetAndGetTemperatureUnitResponse) {
        if (!datagram.temperatureUnit) return false;
        if (datagram.temperatureUnit !== this._config.temperatureUnit) {
            this._config.temperatureUnit = datagram.temperatureUnit;
            return true;
        }
        return false;
    }

    private updateLanguage(datagram: SetAndGetLanguageResponse): boolean {
        if (!datagram.language) return false;
        if (datagram.language !== this._config.language) {
            this._config.language = datagram.language;
            return true;
        }
        return false;
    }

    private updateVersion(datagram: GetVersionResponse) {
        let changed = false;

        if (datagram.hardwareVersion && datagram.hardwareVersion !== this._info.hardwareVersion) {
            this._info.hardwareVersion = datagram.hardwareVersion;
            changed = true;
        }

        if (datagram.softwareVersion && datagram.softwareVersion !== this._info.softwareVersion) {
            this._info.softwareVersion = datagram.softwareVersion;
            changed = true;
        }

        if (datagram.feature !== undefined && datagram.feature !== this._info.feature) {
            this._info.feature = datagram.feature;
            changed = true;
        }

        if (datagram.supportNew !== undefined && datagram.supportNew !== this._info.supportNew) {
            this._info.supportNew = datagram.supportNew;
            changed = true;
        }

        return changed;
    }

    private updateOutputElectricity(datagram: SetAndGetOutputElectricityResponse) {
        if (datagram.electricity !== this._config.maxElectricity) {
            this._config.maxElectricity = datagram.electricity;
            return true;
        }
        return false;
    }


    private updatePasswordError(datagram: PasswordErrorResponse) {
        const wasLoggedIn = this.isLoggedIn();
        this._lastActiveLogin = undefined;
        if (wasLoggedIn && !this.isLoggedIn()) {
            this.dispatchEvent("changed", datagram);
            return true;
        }
        return false;
    }

    public async setName(name: string): Promise<void> {
        await this.sendDatagram(new SetAndGetNickName().setAction(SetAndGetNickNameAction.SET).setNickName("ACP#" + name));
        const response = await this.waitForResponse(SetAndGetNickNameResponse.COMMAND, 5000) as SetAndGetNickNameResponse;
        if (response.nickName !== name) {
            throw new Error(`Failed to set name '${name}': EVSE reported back name '${response.nickName}'`);
        }
        this._config.name = name;
        this.dispatchEvent("changed", response);
    }

    public async setOffLineCharge(status: OffLineChargeStatus): Promise<void> {
        await this.sendDatagram(new SetAndGetOffLineCharge().setAction(OffLineChargeAction.SET).setStatus(status));
        const response = await this.waitForResponse(SetAndGetOffLineChargeResponse.COMMAND, 5000) as SetAndGetOffLineChargeResponse;
        if (response.status != status) {
            throw new Error(`Failed to set offlineCharge to ${status}: EVSE reported back status ${response.status}`);
        }
        this._config.offLineCharge = status;
        this.dispatchEvent("changed", response);
    }

    public async setTemperatureUnit(unit: TemperatureUnit): Promise<void> {
        await this.sendDatagram(new SetAndGetTemperatureUnit().setAction(SetAndGetTemperatureUnitAction.SET).setTemperatureUnit(unit));
        const response = await this.waitForResponse(SetAndGetTemperatureUnitResponse.COMMAND, 5000) as SetAndGetTemperatureUnitResponse;
        if (response.temperatureUnit !== unit) {
            throw new Error(`Failed to set temperature unit to ${unit}: EVSE reported back unit ${response.temperatureUnit}`);
        }
        this._config.temperatureUnit = unit;
        this.dispatchEvent("changed", response);
    }

    public async setLanguage(language: Language): Promise<void> {
        await this.sendDatagram(new SetAndGetLanguage().setAction(SetAndGetLanguageAction.SET).setLanguage(language));
        const response = await this.waitForResponse(SetAndGetLanguageResponse.COMMAND, 5000) as SetAndGetLanguageResponse;
        if (response.language !== language) {
            throw new Error(`Failed to set language to ${language}: EVSE reported back language ${response.language}`);
        }
        this._config.language = language;
        this.dispatchEvent("changed", response);
    }

    public async setMaxElectricity(amps: number): Promise<void> {
        await this.sendDatagram(new SetAndGetOutputElectricity().setAction(SetAndGetOutputElectricityAction.SET).setElectricity(amps));
        const response = await this.waitForResponse(SetAndGetOutputElectricityResponse.COMMAND, 5000) as SetAndGetOutputElectricityResponse;
        if (response.electricity !== amps) {
            throw new Error(`Failed to set output electricity to ${amps}: EVSE reported back ${response.electricity}`);
        }
        this.dispatchEvent("changed", response);
    }

    public async fetchSystemTime(): Promise<Date | undefined> {
        await this.sendDatagram(new SetAndGetSystemTime().setAction(SystemTimeAction.GET));
        const response = await this.waitForResponse(SetAndGetSystemTimeResponse.COMMAND, 5000) as SetAndGetSystemTimeResponse;
        return response.time;
    }

    public async setSystemTime(time?: Date): Promise<void> {
        const datagram = new SetAndGetSystemTime().setAction(SystemTimeAction.SET);
        if (time) datagram.setTime(time);

        await this.sendDatagram(datagram);

        const response = await this.waitForResponse(SetAndGetSystemTimeResponse.COMMAND, 5000) as SetAndGetSystemTimeResponse;

        const responseTime = response.time;
        if (!responseTime) {
            throw new Error('Response does not have a time');
        }

        const datagramTime = datagram.time;
        if (!datagramTime) {
            throw new Error('Datagram time is undefined');
        }

        // Require the set date and the returned date to be within 2 seconds of each other.
        if (Math.abs(responseTime.getTime() - datagramTime.getTime()) > 2000) {
            throw new Error(`Failed to set system time to ${datagram.time}: EVSE reported back ${response.time}`);
        }
    }

    public async chargeStart(params: ChargeStartParams = {}): Promise<ChargeStartResult> {
        const maxAmps = params.maxAmps || this._config.maxElectricity;
        if (!maxAmps) {
            throw new Error("No maxAmps value specified for chargeStart, and none available from configuration.");
        } else {
            const evseMaxAmps = this.info.maxElectricity || 32;
            if (maxAmps < 6 || maxAmps > evseMaxAmps) {
                throw new Error(`Invalid maxAmps value ${maxAmps} specified for chargeStart; valid range is 6-${evseMaxAmps}A`);
            }
        }

        const chargeStart = new ChargeStart()
            .setLineId(params.singlePhase || this._info.phases !== Phases.THREE_PHASE ? 1 : 2)
            .setUserId(params.userId)
            .setChargeId(params.chargeId)
            .setReservationDate(params.startAt)
            .setMaxDurationMinutes(params.maxDurationMinutes)
            .setMaxEnergyKWh(params.maxEnergyKWh)
            .setMaxElectricity(maxAmps);
        await this.sendDatagram(chargeStart);
        const response = await this.waitForResponse(ChargeStartResponse.COMMAND, 5000) as ChargeStartResponse;

        const result = response.reservationResult;


        if (response.errorReason || !result || !successReservationResults.includes(result)) {
            throw new ChargeStartError(response);
        }

        // If a different maxAmps was requested than the currently configured value, then update the configuration.
        // Don't fail the chargeStart if this config write fails because charging has started; just log any error.
        if (maxAmps !== this._config.maxElectricity) {
            this.setMaxElectricity(maxAmps).catch(error => {
                logError(`Failed to change maxElectricity config to ${maxAmps}A after successful chargeStart for EVSE ${this._info.serial}: ${error.message}. The EVSE will still have the old configured value for subsequent charges that don't explicitly set maxAmps, and for other apps.`);
            });
        }

        return {
            reservationResult: result,
            startResult: response.startResult,
            errorReason: response.errorReason,
            maxElectricity: response.maxElectricity
        };
    }

    public async chargeStop(params: ChargeStopParams = {}): Promise<ChargeStopResult> {
        const chargeStop = new ChargeStop().setUserId(params.userId);
        await this.sendDatagram(chargeStop);
        const response = await this.waitForResponse(ChargeStopResponse.COMMAND, 5000) as ChargeStopResponse;

        if (response.failReason) {
            throw new Error(`chargeStop failed with reason ${response.failReason}`);
        }

        return {
            stopResult: response.stopResult,
            failReason: response.failReason
        };
    }
}
