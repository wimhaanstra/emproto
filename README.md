# EM Protocol Handler

Communicates with wallboxes ("EVSEs") using the EvseMaster app: Besen, Telestar, evseODM, ...

This library also includes a small [CLI test runner](#cli-test-runner) which you may use to read info from and control EVSEs. 

## Installation

There is no npm package yet; for now, you can use the protocol handler library by cloning the repository and adding a filesystem dependency.

```bash
# Clone repository to local directory.
git clone https://github.com/johnwoo-nl/emproto.git

# Navigate to your own project.
cd my-project

# Add a filesystem dependency to the cloned repository.
npm i ../emproto
```

## Requirements

- Nodejs 20.14.10 or newer.
- Build toolchain or runtime supporting Typescript and ES6 modules.

## Library usage

### Communicator usage

```typescript
import { createCommunicator } from "emproto";

// Instantiate a communicator.
const communicator = createCommunicator();

// Listen for events.
communicator.addEventListener(["added", "changed", "removed"], (evse, event) => {
    // EVSE was added, changed or removed (event in second parameter).
    // Maybe your app wants to update its UI or perform some action now.
    // You could also register separate listeners for separate events. 
});

// You can remove event listeners again, but if your app just creates a single
// communicator instance for the duration of its lifetime, you could skip this.
// The listener must be the same Function instance that you passed to
// addEventListener.
communicator.removeEventListener("changed", listener);

// If you wish to persist the EVSEs list, you can load it from a file (or array
// previously obtained from getEvses). This is optional; you could also have the
// communicator re-discover the EVSEs on next run, but you'd have to login again
// (your app would need to save the password somewhere). By saving the EVSEs list
// and loading it here, the communicator will automatically login to the EVSEs
// again and keep their state up-to-date.
communicator.loadEvses("~/evses.json");

// A communicator can always hold EVSEs state, but won't start communicating with
// EVSEs until it is started. This method may throw an error if there is some issue
// setting up the UDP socket.
await communicator.start();

// Get a list of EVSEs currently in the communicator's list.
communicator.getEvses().forEach(evse => {
    // Do something with the EVSE.
});

// Or get a specific EVSE by serial (which is the unique identifier of an EVSE).
// Returns undefined if there is no EVSE with given serial.
const evse = communicator.getEvse('1234567890');

// When your app is done, stop the communicator.
communicator.stop();

// You may also wish to persist the EVSEs list when your app is stopping.
communicator.saveEvses("~/evses.json");
```

### EVSE usage

#### Getting EVSE info and configuration

```typescript
import { EmEvseInfo, EmEvseConfig } from "emproto/types";

// Get the general info of an EVSE (which you got from the communicator via getEvse,
// getEvses or an event listener).
const info = evse.getInfo();

// Info is an EmEvseInfo instance.
console.log(`Serial: ${info.serial}`);
console.log(`Brand and model: ${info.brand} ${info.model}`);
console.log(`Software version: ${info.softwareVersion}`);
console.log(`Maximum total supported output power: ${info.maxPower} watts`);
console.log(`Maximum supported output current per phase: ${info.maxElectricity} amps`);

// Get the configuration data of an EVSE. This info is only available when logged in,
// and is retrieved by the communicator immediately after a valid login.
const config = evse.getConfig();

// Config is an EmEvseConfig instance.
console.log(`Name: ${config.name}`);
console.log(`Temperature unit: ${config.temperatureUnit}`);
console.log(`Language: ${config.language}`);
console.log(`Offline charging: ${config.offLineCharge}`);
console.log(`Configured maximum current per phase: ${config.maxElectricity}`);
// Note: config.maxElectricity is not actually used directly by the EVSE for charging
// sessions; it seems to just be a way to persist the user's preference on the EVSE so
// that various apps can share it. The actual current limit for charging is passed as a
// parameter to chargeStart. Your app should default to this configured maxElectricity
// when presenting the user with options to start a charging session. It should also
// update this configuration field if the user changed the current limit when starting
// a session, so other apps will know about it and can also use that limit.
```

#### Logging in

```typescript
// Use the same 6-digit password as for the OEM app.
// This method will throw an error if the password is incorrect.
await evse.login("123456");

// Note: upon successful login, the communicator will request the EVSE's configuration.
// The password is kept in the EVSE instance and is persisted via saveEvses/loadEvses.
// This allows the communicator to automatically login to the EVSE again when it is 
// started again at a later time.
```

#### Reading charging status of lines (connectors, plugs)

Once logged in, the EVSE will start sending us info about its lines (aka plugs, connectors).
Theoretically, an EVSE could have multiple lines, but in practice all EVSEs supported by the
OEM app seem to have just one line (suggested by the fact that the OEM app uses hardcoded
value 1 for `lineId` in various places). In any case, the EVSE will not have any information
about its lines until the library logs in. After logging in, it can take a few seconds before
the first update arrives, and the lines array will be updated about once every 5-10 seconds.
The library checks incoming info against the current state it has, and if anything changed,
the state will be updated and a "changed" event will be fired for the EVSE.

```typescript
import { EmEvseLine } from "emproto/types";

const lines = evse.getLines();
// Lines is a Map of EmEvseLine instances keyed by their lineId. In practice all supported
// EVSEs will have just one, with lineId=1.
const line1 = lines.get(1);

// State fields.
console.log(`State: ${line1.currentState}`); // See EmEvseCurrentState enum
console.log(`Gun state: ${line1.gunState}`); // See EmEvseGunState enum
console.log(`Charging state: ${line1.outputState}`); // See EmEvseOutputState enum

// Power across all phases.
console.log(`Current power: ${line1.currentPower} W`);
// Volts and amps per phase (l2 and l3 also available). Amps obviously will only be nonzero when charging.
console.log(`Current voltage (phase L1): ${line1.l1Voltage} V`);
console.log(`Current amps (phase L1): ${line1.l1Electricity} A`);

// Temperatures. There are two values, inner and outer, but they may be equal if the EVSE only
// has one sensor (or outer temp may be omitted).
console.log(`Inner temperature: ${line1.innerTemp} °C`);
console.log(`Outer temperature: ${line1.outerTemp} °C`);

// Errors list as an array of EmEvseErrorState values. May this array forever remain empty.
console.log(`Errors: ${line1.errors.join(", ")}`);
```

#### Getting configuration

```typescript
// getConfig returns the current config. It is not async and non-blocking.
const config = evse.getConfig();
console.log(`Name: ${config.name}`);

// However, immediately after logging in, the communicator is still working to get the
// config, and not all fields may be set. Or, if the communicator logged in to the EVSE
// before, there may be a stale value. If you want to be certain that you have the
// current, live config, use getLiveConfig. This method returns a promise that will
// resolve with the config once it's available. You can call this method right after
// login() returns (it will recycle the same promise if the config is already being
// fetched).
const liveConfig = await evse.getLiveConfig();
console.log(`Name: ${config.name}`);

// You can also just call getLiveConfig without using its return value to trigger an
// update. Any changes in config will also result in a "changed" event for the EVSE.
// This is useful if you wish to add some "Refresh" button to your app's UI of the
// EVSE's configuration and your UI is driven by these events. The communicator
// currently only does it right after login.
evse.getLiveConfig().then();
```

#### Changing configuration

The EVSE must be online and logged in to change these configuration settings.
Upon successful change, the EVSE's config data structure will also be updated and a
"changed" event will be emitted for the EVSE.

```typescript
await evse.setName("My wallbox");
await evse.setOffLineCharge("DISABLED");
await evse.setTemperatureUnit("CELSIUS");
await evse.setLanguage("ENGLISH");
```

#### Starting a charging session

```typescript
import { EmChargeStartOptions } from "emproto/types";

// Start a charging session using 6 amps on each phase. The maxAmps field is required.
// It is strongly suggested that your app defaults this value to the maxElectricity
// set in config. Of course it could allow the user to alter the value (never above
// getInfo().maxElectricity which specifies the maximum value supported by the EVSE)
// and remember the user's preference for next time, also storing it in the EVSE's
// configuration using setMaxElectricity.
await evse.chargeStart({ maxAmps: 6});

// You may also specify a user name of the person using your app. This name will be
// visible in historical charge records (including those in the OEM app). Maximum
// length is 16 ASCII characters.
await evse.chargeStart({ maxAmps: 6, userId: "John Doe" });

// You may also specify a custom identifier for the session, for example to correlate
// the session stored on the EVSE with one stored in your app's database. Maximum
// length is 16 ASCII characters.
await evse.chargeStart({ maxAmps: 6, sessionId: "ABC123" });

// You can delay-start a session by specifying a start time. If omitted or the time
// is not in the future, charging will start immediately. Starting one hour from now:
await evse.chargeStart({
    maxAmps: 6,
    startTime: new Date(Date.now() + (3600 * 1000))
});
// Note: There is no way yet of inspecting whether a delayed session is planned.

// You can limit the duration (in minutes, integer) and/or the amount of energy (in
// kWh, float) of the session:
await evse.chargeStart({
    maxAmps: 6,
    maxDurationMinutes: 90,
    maxEnergyKWh: 7.5
});
// Note: There is no way yet of inspecting what the limits are for an ongoing session.
//       For now, suggest that your app remembers it (possibly using the sessionId
//       correlator which it can set itself at start time).
```

#### Stopping an ongoing charging session

```typescript
// Stop a charging session.
await evse.chargeStop();

// Like when starting a session, you can also specify a user name of the person who
// stopped the session:
await evse.chargeStop({ userId: "John Doe" });
````

## CLI test runner

The CLI runner is also written in Typescript, so a plain nodejs runtime will not be able to run it directly.
You can run it from the emproto root like this:

```bash
npx tsx clitest
```
This will discover EVSEs on the network and print some info as changes are detected. Press Ctrl+C to exit.

Add `dump` (to any command) to dump incoming and outgoing datagrams (note: once logged in, you'll get more info but the EVSE's password will be present in the dumped datagrams, so don't copy-paste them to the internet).

To login, set a password like this:
```bash
npx tsx clitest EC311S=123456
```
"EC311S" in this example is the model name of the charger, but you can use any part of the serial, brand or model. The CLI runner will try to login using the 6-digit password on the first matching EVSE.
If login is successful, the password will also be persisted in ~/evses.json, so you can just run `npx tsx clitest` next time and see the EVSE's detail info without needing to specify the password again.
For EVSEs that the CLI runner can login to, it will also print the "lines" (plugs, connectors) that are available on the EVSE with that charging status. Most will have just one line.

To show info of a specific EVSE, use the same type of filter as for login:
```bash
npx tsx clitest EC311S
```

To start a session, use the `start=<amps>` command, specifying the maximum amperage to use. You can specify a filter to run the command on a specific EVSE; otherwise the first online EVSE that the CLI runner can login to will be used.
```bash
npx tsx clitest start=6

# or to target the same EVSE as the examples above:

npx tsx clitest EC311S start=6
```

To stop a session, use the `stop` command. You can again specify a filter to target a specific EVSE (instead of using the first available online one).
```bash
npx tsx clitest stop
```

***IMPORTANT NOTE***

The CLI runner makes it easy to quickly run start/stop commands. But each start c.q. stop will
cause both the EVSE's AC phase relays as well as the car's high-voltage DC contactors to engage c.q. disengage.
Doing this too often in quick succession **will wear these parts**!
