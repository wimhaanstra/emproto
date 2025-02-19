import { Communicator } from "./Communicator";
import Evse from "./Evse";
import { EmCommunicatorConfig } from "./util/types";

/**
 * Create a new communicator instance.
 * @param config Configuration (optional).
 */
export function createCommunicator(config: Partial<EmCommunicatorConfig> = {}): Communicator {
    return new Communicator(config);
}

export { Communicator, Evse };