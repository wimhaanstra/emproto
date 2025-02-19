import { ChargeStartResponse } from "../dgrams/impl/ChargeStart";
import { ChargeStartErrorReason, ChargeStartReservationResult } from "../util/types";

export const successReservationResults = [
    ChargeStartReservationResult.IMMEDIATE_START,       // Not an error; no reservation was being made.
    ChargeStartReservationResult.RESERVATION_OK,        // Reservation was successful.
    ChargeStartReservationResult.RESERVATION_IN_PAST    // Not an error because the wallbox will just start charging immediately.
];

export class ChargeStartError extends Error {
    public readonly errorReason: ChargeStartErrorReason | undefined;
    public readonly reservationResult: ChargeStartReservationResult | undefined;

    constructor(response: ChargeStartResponse) {
        let message = `Charge start failed with error: ${response.errorReason}`;
        if (response.reservationResult !== ChargeStartReservationResult.IMMEDIATE_START) {
            message += `; reservation result: ${response.reservationResult}`;
        }
        super(message);

        this.errorReason = response.errorReason;
        this.reservationResult = response.reservationResult;
    }
}
