import { dateToEmTimestamp } from "../../../util/util";
import { ChargeStart } from "../ChargeStart";

describe("ChargeStart", () => {
    it("should pack payload correctly", () => {
        const chargeStart = new ChargeStart();
        chargeStart.setLineId(1)
            .setUserId("testuser")
            .setChargeId("2025010112000000")
            .setReservationDate(new Date("2025-02-18T12:00:00Z"))
            .setStartType(1)
            .setChargeType(1)
            .setMaxDurationMinutes(120)
            .setMaxEnergyKWh(50)
            .setMaxElectricity(16);

        const buffer = chargeStart.packPayload();

        expect(buffer.length).toBe(47);
        expect(buffer.readUInt8(0)).toBe(1);
        //expect(buffer.toString("ascii", 1, 17).trim()).toBe("testuser");
        expect(buffer.toString("ascii", 17, 33)).toBe("2025010112000000");
        expect(buffer.readUInt8(33)).toBe(0);
        expect(buffer.readUInt32BE(34)).toBe(dateToEmTimestamp(new Date("2025-02-18T12:00:00Z")));
        expect(buffer.readUInt8(38)).toBe(1);
        expect(buffer.readUInt8(39)).toBe(1);
        expect(buffer.readUInt16BE(40)).toBe(120);
        expect(buffer.readUInt16BE(42)).toBe(5000);
        expect(buffer.readUInt16BE(44)).toBe(65535);
        expect(buffer.readUInt8(46)).toBe(16);
    });

    it("should throw an error if maxElectricity is not set or out of range", () => {
        const chargeStart = new ChargeStart();

        expect(() => chargeStart.packPayload()).toThrowError("Invalid maxElectricity (amps), must be between 6 and 32");

        chargeStart.setMaxElectricity(5);
        expect(() => chargeStart.packPayload()).toThrowError("Invalid maxElectricity (amps), must be between 6 and 32");

        chargeStart.setMaxElectricity(33);
        expect(() => chargeStart.packPayload()).toThrowError("Invalid maxElectricity (amps), must be between 6 and 32");
    });

    it("should set and get properties correctly", () => {
        const chargeStart = new ChargeStart();
        chargeStart.setLineId(2)
            .setUserId("testuser")
            .setChargeId("2025021812001234")
            .setReservationDate(new Date("2025-02-18T12:00:00Z"))
            .setStartType(2)
            .setChargeType(2)
            .setMaxDurationMinutes(60)
            .setMaxEnergyKWh(25)
            .setMaxElectricity(20);

        expect(chargeStart.getLineId()).toBe(2);
        expect(chargeStart["userId"]).toBe("testuser");
        expect(chargeStart["chargeId"]).toBe("2025021812001234");
        expect(chargeStart["reservationDate"]).toEqual(new Date("2025-02-18T12:00:00Z"));
        expect(chargeStart["startType"]).toBe(2);
        expect(chargeStart["chargeType"]).toBe(2);
        expect(chargeStart["maxDurationMinutes"]).toBe(60);
        expect(chargeStart["maxEnergyKWh"]).toBe(25);
        expect(chargeStart["maxElectricity"]).toBe(20);
    });
});