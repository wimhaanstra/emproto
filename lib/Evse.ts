import { clearTimeout } from "node:timers";
import Communicator from "./Communicator.ts";
import EmDatagram from "./dgrams/EmDatagram.ts";
import {
    type DispatchEvent,
    type EmEvseConfig,
    type EmEvseEvent,
    type EmEvseInfo,
    type EmEvseLine,
    type Language,
    isEmEvseInfo,
    OffLineChargeAction,
    OffLineChargeStatus,
    SetAndGetLanguageAction,
    SetAndGetNickNameAction,
    SetAndGetOutputElectricityAction,
    SetAndGetTemperatureUnitAction,
    TemperatureUnit,
    EmEvse,
    ChargeStartParams,
    ChargeStartResult,
    ChargeStopParams,
    ChargeStopResult
} from "util/types.ts";
import { decodePassword, encodePassword, logError, logWarning, toDate, update } from "util/util.ts";
import { LoginAbstract, LoginConfirm, LoginResponse, RequestLogin } from "./dgrams/impl/Login.ts";
import { SingleACStatus } from "./dgrams/impl/SingleACStatus.ts";
import { SetAndGetNickName, SetAndGetNickNameResponse } from "./dgrams/impl/SetAndGetNickName.ts";
import { SetAndGetTemperatureUnit, SetAndGetTemperatureUnitResponse } from "./dgrams/impl/SetAndGetTemperatureUnit.ts";
import { SetAndGetOutputElectricity, SetAndGetOutputElectricityResponse } from "./dgrams/impl/SetAndGetOutputElectricity.ts";
import { SetAndGetOffLineCharge, SetAndGetOffLineChargeResponse } from "./dgrams/impl/SetAndGetOffLineCharge.ts";
import { SetAndGetLanguage, SetAndGetLanguageResponse } from "./dgrams/impl/SetAndGetLanguage.ts";
import { GetVersion, GetVersionResponse } from "./dgrams/impl/GetVersion.ts";
import { HeadingResponse } from "./dgrams/impl/Heading.ts";
import { PasswordErrorResponse } from "./dgrams/impl/PasswordErrorResponse.ts";
import { ChargeStart, ChargeStartResponse } from "./dgrams/impl/ChargeStart.ts";
import { ChargeStop, ChargeStopResponse } from "./dgrams/impl/ChargeStop.ts";

export default class Evse implements EmEvse {

    private readonly communicator: Communicator;
    private readonly dispatchEvent: (event: EmEvseEvent, datagram?: EmDatagram) => void;

    private readonly info: EmEvseInfo;
    private config: EmEvseConfig;
    private lastSeen: Date;
    private lastActiveLogin: Date|undefined = undefined;
    private lastConfigUpdate: Date|undefined;
    private online: boolean;
    private password: string|undefined;
    private readonly lines: Map<number, EmEvseLine> = new Map();
    private configUpdatePromise?: Promise<any>;

    constructor(communicator: Communicator,
                dispatchEvent: DispatchEvent,
                info: EmEvseInfo | {info: object, config?: object, lastSeen?: Date|number|string, lastConfigUpdate?: Date|number|string}) {
        this.communicator = communicator;
        this.dispatchEvent = (event: EmEvseEvent, datagram?: EmDatagram) => dispatchEvent(event, this, datagram);

        if (isEmEvseInfo(info)) {
            // Creating new discovered EVSE.
            this.info = { ... info };
            this.config = {};
            this.lastSeen = new Date();
            this.online = true;
        } else {
            // Loading EVSE from persistent storage.
            if (!isEmEvseInfo(info.info)) {
                throw new Error("Invalid EmEvseInfo in EmEvse constructor: " + JSON.stringify(info.info));
            }
            this.info = { ... info.info };
            this.config = info.config ? { ... info.config } : {};
            this.online = false;
            this.lastSeen = toDate(info.lastSeen);
            this.lastConfigUpdate = toDate(info.lastConfigUpdate);
            this.updateOnlineStatus();
        }
    }

    public getInfo(): EmEvseInfo {
        return this.info;
    }

    public getConfig(): EmEvseConfig {
        return this.config;
    }

    public getLastSeen(): Date {
        return this.lastSeen;
    }

    public getLastConfigUpdate(): Date|undefined {
        return this.lastConfigUpdate;
    }

    public isOnline(): boolean {
        return this.online;
    }

    public isLoggedIn(): boolean {
        return this.lastActiveLogin !== undefined
            && this.lastActiveLogin.getTime() > (Date.now() - (1000 * 15));
    }

    public hasPassword(): boolean {
        return this.password !== undefined;
    }

    public checkPassword(password: string) {
        return this.password && this.password === password;
    }

    public getLines(): Map<number, EmEvseLine> {
        return this.lines;
    }

    public sendDatagram(datagram: EmDatagram): Promise<number> {
        if (datagram instanceof HeadingResponse) {
            this.lastActiveLogin = new Date();
            // lastActiveLogin is transient, so no changed event necessary. We need to re-login
            // anyway after an app restart.
        }
        return this.communicator.send(datagram, this);
    }

    public updateIp(ip: string, port: number): boolean {
        this.lastSeen = new Date();
        let changed = false;

        if (this.updateOnlineStatus()) {
            changed = true;
        }

        if (ip !== this.info.ip) {
            this.info.ip = ip;
            changed = true;
        }

        if (port !== this.info.port) {
            this.info.port = port;
            changed = true;
        }

        return changed;
    }

    public updateOnlineStatus(): boolean {
        const now = Math.floor(new Date().getTime() / 1000);
        const lastSeen = this.lastSeen ? Math.floor(this.lastSeen.getTime() / 1000) : 0;
        const onlineNow = lastSeen > now - this.communicator.config.offlineAfterLastDatagram;

        if (onlineNow !== this.online) {
            this.online = onlineNow;
            return true;
        }

        return false;
    }

    public update(datagram: EmDatagram): boolean {
        if (datagram instanceof LoginAbstract) {
            return this.updateLogin(datagram);
        }
        if (datagram instanceof SingleACStatus) {
            return this.updateSingleAcStatus(datagram);
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
        if (this.info.serial !== login.getDeviceSerial()) {
            return false;
        }

        this.lastSeen = new Date();
        let changed = this.updateOnlineStatus();

        if (this.info.brand !== login.getBrand()) {
            this.info.brand = login.getBrand();
            changed = true;
        }

        if (this.info.model !== login.getModel()) {
            this.info.model = login.getModel();
            changed = true;
        }

        if (this.info.hardwareVersion !== login.getHardwareVersion()) {
            this.info.hardwareVersion = login.getHardwareVersion();
            changed = true;
        }

        if (this.info.maxPower !== login.getMaxPower()) {
            this.info.maxPower = login.getMaxPower();
            changed = true;
        }

        if (this.info.maxElectricity !== login.getMaxElectricity()) {
            this.info.maxElectricity = login.getMaxElectricity();
            changed = true;
        }

        if (this.info.hotLine !== login.getHotLine()) {
            this.info.hotLine = login.getHotLine();
            changed = true;
        }

        return changed;
    }

    private updateSingleAcStatus(datagram: SingleACStatus): boolean {
        const existing = this.lines.get(datagram.lineId);
        const line = existing || {
            lineId: datagram.lineId,
        } as EmEvseLine;
        let changed = existing === undefined;
        if (update(line, "currentPower", datagram.currentPower)) changed = true;
        if (update(line, "currentAmount", datagram.currentAmount)) changed = true;
        if (update(line, "l1Voltage", datagram.l1Voltage)) changed = true;
        if (update(line, "l1Electricity", datagram.l1Electricity)) changed = true;
        if (update(line, "l2Voltage", datagram.l2Voltage)) changed = true;
        if (update(line, "l2Electricity", datagram.l2Electricity)) changed = true;
        if (update(line, "l3Voltage", datagram.l3Voltage)) changed = true;
        if (update(line, "l3Electricity", datagram.l3Electricity)) changed = true;
        if (update(line, "innerTemp", datagram.innerTemp)) changed = true;
        if (update(line, "outerTemp", datagram.outerTemp)) changed = true;
        if (update(line, "currentState", datagram.currentState)) changed = true;
        if (update(line, "gunState", datagram.gunState)) changed = true;
        if (update(line, "outputState", datagram.outputState)) changed = true;
        if (update(line, "errors", datagram.errorState)) changed = true;

        if (!existing) {
            this.lines.set(line.lineId, line);
        }
        return changed;
    }

    /**
     * Serialize this EmEvse to a plain object.
     * @returns Plain object representing this EmEvse.
     */
    public serialize(): object {
        return {
            info: this.info,
            config: this.config,
            lastConfigUpdate: this.lastConfigUpdate ? Math.floor(this.lastConfigUpdate.getTime() / 1000) : undefined,
            lastSeen: this.lastSeen ? Math.floor(this.lastSeen.getTime() / 1000) : undefined,
            password: encodePassword(this.password)
        };
    }

    /**
     * Deserialize an EmEvse from a plain object.
     * @param communicator EmCommunicator instance to associate with the deserialized EmEvse.
     * @param dispatchEvent Function to dispatch events via the communicator.
     * @param data Plain object to deserialize.
     * @returns Deserialized EmEvse instance, or undefined if the plain object cannot be deserialized to a valid EmEvse.
     */
    public static deserialize(communicator: Communicator, dispatchEvent: DispatchEvent, data: any): Evse|undefined {
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

        if (typeof data.password === "string") evse.password = decodePassword(data.password);

        return evse;
    }

    /**
     * Merge fields of other EmEvse into this instance.
     * @param other Other EmEvse whose fields to merge into this instance.
     * @returns True if any fields on this instance were changed, false if no fields were changed.
     */
    public merge(other: Evse): boolean {
        if (this.info.serial !== other.info.serial) {
            return false;
        }

        let changed = false;

        if (other.password && (!this.password || other.password !== this.password)) {
            this.password = other.password;
            changed = true;
        }

        if (other.lastSeen && (!this.lastSeen || other.lastSeen > this.lastSeen)) {
            this.lastSeen = other.lastSeen;
            changed = true;
        }

        if (this.updateOnlineStatus()) {
            changed = true;
        }

        if (other.info.ip && (!this.info.ip || other.info.ip !== this.info.ip)) {
            this.info.ip = other.info.ip;
            changed = true;
        }

        if (other.info.port && (!this.info.port || other.info.port !== this.info.port)) {
            this.info.port = other.info.port;
            changed = true;
        }

        if (other.info.brand && (!this.info.brand || other.info.brand !== this.info.brand)) {
            this.info.brand = other.info.brand;
            changed = true;
        }

        if (other.info.model && (!this.info.model || other.info.model !== this.info.model)) {
            this.info.model = other.info.model;
            changed = true;
        }

        if (other.info.hardwareVersion && (!this.info.hardwareVersion || other.info.hardwareVersion !== this.info.hardwareVersion)) {
            this.info.hardwareVersion = other.info.hardwareVersion;
            changed = true;
        }

        if (other.info.softwareVersion && (!this.info.softwareVersion || other.info.softwareVersion !== this.info.softwareVersion)) {
            this.info.softwareVersion = other.info.softwareVersion;
            changed = true;
        }

        if (other.info.hotLine && (!this.info.hotLine || other.info.hotLine !== this.info.hotLine)) {
            this.info.hotLine = other.info.hotLine;
            changed = true;
        }

        if (other.info.maxPower && (!this.info.maxPower || other.info.maxPower !== this.info.maxPower)) {
            this.info.maxPower = other.info.maxPower;
            changed = true;
        }

        if (other.info.maxElectricity && (!this.info.maxElectricity || other.info.maxElectricity !== this.info.maxElectricity)) {
            this.info.maxElectricity = other.info.maxElectricity;
            changed = true;
        }

        if (other.info.feature !== undefined && other.info.feature !== this.info.feature) {
            this.info.feature = other.info.feature;
            changed = true;
        }

        if (other.info.supportNew !== undefined && other.info.supportNew !== this.info.supportNew) {
            this.info.supportNew = other.info.supportNew;
            changed = true;
        }

        if (other.config.name && (!this.config.name || other.config.name !== this.config.name)) {
            this.config.name = other.config.name;
            changed = true;
        }

        this.config = { ... this.config, ... other.config };

        return changed;
    }

    public async waitForResponse(command: number|number[], timeoutMillis: number): Promise<EmDatagram> {
        if (typeof command === "number") command = [ command ];
        return new Promise((resolve, reject) => {
            let timeout: NodeJS.Timeout;
            const listener = (evse: Evse, event: EmEvseEvent, datagram?: EmDatagram) => {
                if (datagram && evse.info.serial === this.info.serial && command.includes(datagram.getCommand())) {
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
        await this.sendDatagram(new RequestLogin().setDevicePassword(password));
        // 2. Wait for the EVSE to reply with a LoginResponse (correct password)
        // or a PasswordErrorResponse (invalid password).
        const response = await this.waitForResponse([LoginResponse.COMMAND, PasswordErrorResponse.COMMAND], 3000);
        if (response instanceof PasswordErrorResponse) {
            throw new Error("Invalid password");
        }
        // 3. If we get the LoginResponse then the password was correct, so set it on this instance.
        if (password !== undefined && this.password !== password) {
            this.password = password;
            this.dispatchEvent("changed", response);
        }
        // 4. Send the LoginConfirm, completing the login flow. After this the EVSE can take commands.
        await this.sendDatagram(new LoginConfirm().setDevicePassword(password));
        // 5. Mark this evse as having an active session.
        this.lastActiveLogin = new Date();
        // 6. Request EVSE's configuration. We don't need to wait for this; the login is complete.
        this.fetchConfig().catch(error => {
            logError(`Failed to get configuration for ${this.info.serial} after login: ${error.message}`);
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
        if (this.configUpdatePromise === undefined) {
            if (this.lastConfigUpdate && this.lastConfigUpdate.getTime() > (Date.now() - (orCachedUntilSeconds * 1000))) {
                return this.config;
            }
            // Set up the receivers for the configuration datagrams. We do this before sending out the
            // requests to avoid missing any responses for earlier requests while we're still busy
            // sending out the later requests.
            this.configUpdatePromise = Promise.all([
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
        }

        // Wait until all responses are in. If some responses are lost, this composite promise will fail
        // due to one of the underlying promises timing out.
        try {
            await this.configUpdatePromise;
        } finally {
            this.configUpdatePromise = undefined;
        }

        // If we get here then all configuration was received (and EVSE changed events were sent). We
        // only mark the time that configuration was last updated, so we can know later on if we need
        // to refresh.
        this.lastConfigUpdate = new Date();
        this.dispatchEvent("changed");
        return this.config;
    }

    public setDatagramPassword(datagram: EmDatagram) {
        if (this.password !== undefined) {
            datagram.setDevicePassword(this.password);
            return true;
        }
        return false;
    }

    public toString(): string {
        const model = [ this.info.brand, this.info.model ].filter(Boolean).join(" ");
        return `[${this.info.serial}${model ? " " + model : ""} @ ${this.info.ip}]`;
    }

    private updateOfflineCharging(datagram: SetAndGetOffLineChargeResponse) {
        if (this.config.offLineCharge !== datagram.getStatus()) {
            this.config.offLineCharge = datagram.getStatus();
            return true;
        }
        return false;
    }

    private updateNickName(datagram: SetAndGetNickNameResponse) {
        if (!datagram.getNickName()) return false;
        if (datagram.getNickName() !== this.config.name) {
            this.config.name = datagram.getNickName();
            return true;
        }
        return false;
    }

    private updateTemperatureUnit(datagram: SetAndGetTemperatureUnitResponse) {
        if (!datagram.getTemperatureUnit()) return false;
        if (datagram.getTemperatureUnit() !== this.config.temperatureUnit) {
            this.config.temperatureUnit = datagram.getTemperatureUnit();
            return true;
        }
        return false;
    }

    private updateLanguage(datagram: SetAndGetLanguageResponse): boolean {
        if (!datagram.getLanguage()) return false;
        if (datagram.getLanguage() !== this.config.language) {
            this.config.language = datagram.getLanguage();
            return true;
        }
        return false;
    }

    private updateVersion(datagram: GetVersionResponse) {
        let changed = false;

        if (datagram.getHardwareVersion() && datagram.getHardwareVersion() !== this.info.hardwareVersion) {
            this.info.hardwareVersion = datagram.getHardwareVersion();
            changed = true;
        }

        if (datagram.getSoftwareVersion() && datagram.getSoftwareVersion() !== this.info.softwareVersion) {
            this.info.softwareVersion = datagram.getSoftwareVersion();
            changed = true;
        }

        if (datagram.getFeature() !== undefined && datagram.getFeature() !== this.info.feature) {
            this.info.feature = datagram.getFeature();
            changed = true;
        }

        if (datagram.getSupportNew() !== undefined && datagram.getSupportNew() !== this.info.supportNew) {
            this.info.supportNew = datagram.getSupportNew();
            changed = true;
        }

        return changed;
    }

    private updateOutputElectricity(datagram: SetAndGetOutputElectricityResponse) {
        if (datagram.getElectricity() !== this.config.maxElectricity) {
            this.config.maxElectricity = datagram.getElectricity();
            return true;
        }
        return false;
    }


    private updatePasswordError(datagram: PasswordErrorResponse) {
        const wasLoggedIn = this.isLoggedIn();
        this.lastActiveLogin = undefined;
        if (wasLoggedIn && !this.isLoggedIn()) {
            this.dispatchEvent("changed", datagram);
            return true;
        }
        return false;
    }

    public async setName(name: string): Promise<void> {
        await this.sendDatagram(new SetAndGetNickName().setAction(SetAndGetNickNameAction.SET).setNickName("ACP#" + name));
        const response = await this.waitForResponse(SetAndGetNickNameResponse.COMMAND, 5000) as SetAndGetNickNameResponse;
        if (response.getNickName() !== name) {
            throw new Error(`Failed to set name '${name}': EVSE reported back name '${response.getNickName()}'`);
        }
        this.config.name = name;
        this.dispatchEvent("changed", response);
    }

    public async setOffLineCharge(status: OffLineChargeStatus): Promise<void> {
        await this.sendDatagram(new SetAndGetOffLineCharge().setAction(OffLineChargeAction.SET).setStatus(status));
        const response = await this.waitForResponse(SetAndGetOffLineChargeResponse.COMMAND, 5000) as SetAndGetOffLineChargeResponse;
        if (response.getStatus() != status) {
            throw new Error(`Failed to set offlineCharge to ${status}: EVSE reported back status ${response.getStatus()}`);
        }
        this.config.offLineCharge = status;
        this.dispatchEvent("changed", response);
    }

    public async setTemperatureUnit(unit: TemperatureUnit): Promise<void> {
        await this.sendDatagram(new SetAndGetTemperatureUnit().setAction(SetAndGetTemperatureUnitAction.SET).setTemperatureUnit(unit));
        const response = await this.waitForResponse(SetAndGetTemperatureUnitResponse.COMMAND, 5000) as SetAndGetTemperatureUnitResponse;
        if (response.getTemperatureUnit() !== unit) {
            throw new Error(`Failed to set temperature unit to ${unit}: EVSE reported back unit ${response.getTemperatureUnit()}`);
        }
        this.config.temperatureUnit = unit;
        this.dispatchEvent("changed", response);
    }

    public async setLanguage(language: Language): Promise<void> {
        await this.sendDatagram(new SetAndGetLanguage().setAction(SetAndGetLanguageAction.SET).setLanguage(language));
        const response = await this.waitForResponse(SetAndGetLanguageResponse.COMMAND, 5000) as SetAndGetLanguageResponse;
        if (response.getLanguage() !== language) {
            throw new Error(`Failed to set language to ${language}: EVSE reported back language ${response.getLanguage()}`);
        }
        this.config.language = language;
        this.dispatchEvent("changed", response);
    }

    public async setMaxElectricity(amps: number): Promise<void> {
        await this.sendDatagram(new SetAndGetOutputElectricity().setAction(SetAndGetOutputElectricityAction.SET).setElectricity(amps));
        const response = await this.waitForResponse(SetAndGetOutputElectricityResponse.COMMAND, 5000) as SetAndGetOutputElectricityResponse;
        if (response.getElectricity() !== amps) {
            throw new Error(`Failed to set output electricity to ${amps}: EVSE reported back ${response.getElectricity()}`);
        }
        this.dispatchEvent("changed", response);
    }

    public async chargeStart(params: ChargeStartParams): Promise<ChargeStartResult> {
        const chargeStart = new ChargeStart()
            .setLineId(params.lineId)
            .setUserId(params.userId)
            .setChargeId(params.chargeId)
            .setReservationDate(params.startAt)
            .setMaxDurationMinutes(params.maxDurationMinutes)
            .setMaxEnergyKWh(params.maxEnergyKWh)
            .setMaxElectricity(params.maxAmps);
        await this.sendDatagram(chargeStart);
        const response = await this.waitForResponse(ChargeStartResponse.COMMAND, 5000) as ChargeStartResponse;
        if (response.getLineId() !== chargeStart.getLineId()) {
            throw new Error(`chargeStart expected lineId ${chargeStart.getLineId()} in response, got ${response.getLineId()}`);
        }

        if (response.getErrorReason()) {
            throw new Error(`chargeStart failed with reason ${response.getErrorReason()}`);
        }
        return {
            lineId: response.getLineId(),
            reservationResult: response.getReservationResult(),
            startResult: response.getStartResult(),
            errorReason: response.getErrorReason(),
            maxElectricity: response.getMaxElectricity()
        };
    }

    public async chargeStop(params?: ChargeStopParams): Promise<ChargeStopResult> {
        const chargeStop = new ChargeStop().setLineId(params?.lineId).setUserId(params?.userId);
        await this.sendDatagram(chargeStop);
        const response = await this.waitForResponse(ChargeStopResponse.COMMAND, 5000) as ChargeStopResponse;
        if (response.getLineId() !== chargeStop.getLineId()) {
            throw new Error(`chargeStop expected lineId ${chargeStop.getLineId()} in response, got ${response.getLineId()}`);
        }
        if (response.getFailReason()) {
            throw new Error(`chargeStop failed with reason ${response.getFailReason()}`);
        }
        return {
            lineId: response.getLineId(),
            stopResult: response.getStopResult(),
            failReason: response.getFailReason()
        };
    }
}
