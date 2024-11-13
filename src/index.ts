import Communicator from "./Communicator.js";
import { EmCommunicatorConfig } from "./util/types.js";

/**
 * Create a new communicator instance.
 * @param config Configuration (optional).
 */
export function createCommunicator(config: Partial<EmCommunicatorConfig> = {}): Communicator {
    return new Communicator(config);
}
