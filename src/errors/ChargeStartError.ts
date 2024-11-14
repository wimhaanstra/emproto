import {ChargeStartResponse} from "../dgrams/impl/ChargeStart.js";
import {ChargeStartErrorReason, ChargeStartReservationResult} from "../util/types.js";

export const successReservationResults = [
    ChargeStartReservationResult.IMMEDIATE_START,       // Not an error; no reservation was being made.
    ChargeStartReservationResult.RESERVATION_OK,        // Reservation was successful.
    ChargeStartReservationResult.RESERVATION_IN_PAST    // Not an error because the wallbox will just start charging immediately.
];

export class ChargeStartError extends Error {
    public readonly errorReason: ChargeStartErrorReason;
    public readonly reservationResult: ChargeStartReservationResult;

    constructor(response: ChargeStartResponse) {
        let message = `Charge start failed with error: ${response.getErrorReason()}`;
        if (response.getReservationResult() !== ChargeStartReservationResult.IMMEDIATE_START) {
            message += `; reservation result: ${response.getReservationResult()}`;
        }
        super(message);
        this.errorReason = response.getErrorReason();
        this.reservationResult = response.getReservationResult();
    }
}
