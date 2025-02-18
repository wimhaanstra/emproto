import { ChargeStartErrorReason, ChargeStartReservationResult } from "../../../util/types";
import { ChargeStartResponse } from "../ChargeStart";
import { Buffer } from "node:buffer";

describe("ChargeStartResponse", () => {
    it("should unpack payload correctly", () => {
        const buffer = Buffer.from([1, 2, 3, 4, 5]);
        const response = new ChargeStartResponse();
        response.unpackPayload(buffer);

        expect(response.lineId).toBe(1);
        expect(response.reservationResult).toBe(ChargeStartReservationResult.RESERVATION_NOT_SUPPORTED);
        expect(response.startResult).toBe(3);
        expect(response.errorReason).toBe(ChargeStartErrorReason.SYSTEM_MAINTENANCE);
        expect(response.maxElectricity).toBe(5);
    });

    it("should throw an error if buffer length is less than 5", () => {
        const buffer = Buffer.from([1, 2, 3, 4]);
        const response = new ChargeStartResponse();

        expect(() => response.unpackPayload(buffer)).toThrowError("Invalid ChargeStartResponse buffer length; expected 5, got 4");
    });

    it("should return an empty buffer for packPayload", () => {
        const response = new ChargeStartResponse();
        const buffer = response.packPayload();

        expect(buffer.length).toBe(0);
    });
});