import Communicator from "./lib/Communicator.ts";
import { EmCommunicatorConfig } from "./util/types.ts";

/**
 * Create a new communicator instance.
 * @param config Configuration (optional).
 */
export function createCommunicator(config: Partial<EmCommunicatorConfig> = {}): Communicator {
    return new Communicator(config);
}
