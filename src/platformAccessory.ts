import { Service, PlatformAccessory, CharacteristicValue, CharacteristicGetCallback, CharacteristicSetCallback } from 'homebridge';
// import { PLUGIN_NAME } from './settings';
import { OnkyoSerialHomebridgePlatform } from './platform';

import Delimiter = require('@serialport/parser-delimiter');

interface Input {
  code: string;
  name: string;
  index: number;
}

/*
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class OnkyoSerialPlatformAccessory {
  private service: Service;
  private inputServices: Service[] = [];
  // private televisionService: Service;
  private tvAccessory;
  // private speakerService: Service;
  private port;
  private parser;
  private muter;
  private maxVolume = 70;
  private minVolume = 0;


  private inputs = {
    '00': 'VCR/DVR',
    '01': 'CBL/SAT',
    '02': 'GAME/TV',
    '03': 'AUX',
    '10': 'BD/DVD',
    '20': 'TAPE',
    '22': 'PHONO',
    '23': 'CD',
    '24': 'FM',
    '25': 'AM',
    '26': 'TUNER',
  };

  private states = {
    powerOn: false,
    volume: 0,
    isMuted:false,
    brightness: 0,
    input: '00', // hex string
    inputs: [] as Input[],
    updates: {
      'SLI': false,
    },
  };

  constructor(
    private readonly platform: OnkyoSerialHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Onkyo')
      .setCharacteristic(this.platform.Characteristic.Model, 'AVR')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get my port
    // this.platform.log.debug(JSON.stringify(this.platform.connections));
    this.port = this.platform.connections[accessory.context.device.path];

    // create a delimiter parser of 1a
    this.parser = this.port.pipe(new Delimiter({delimiter: [0x1a]}));
    this.parser.on('data', this.handleAnswer.bind(this));

    this.service = this.accessory.getService(this.platform.Service.Television) ||
      this.accessory.addService(this.platform.Service.Television);

    this.init();
    this.platform.log.debug('XXXXX:  this.accessory.context.device.displayName');
    this.platform.log.debug('XXXXX: ', this.accessory.context.device.displayName);

  }

  async init() {
    await this.createTVService();
    await this.createTVSpeakerService();
    await this.createInputSourceServices();
    await this.syncState();
  }

  async createTVService() {
    this.service
      .setCharacteristic(
        this.platform.Characteristic.ConfiguredName,
        this.accessory.context.device.displayName,
      )
      .setCharacteristic(
        this.platform.Characteristic.SleepDiscoveryMode,
        this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE,
      );
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .on('get', this.getOn.bind(this))
      .on('set', this.setOn.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
      .on('get', this.getInputState.bind(this))
      .on('set', this.setInputState.bind(this));
  }

  async createTVSpeakerService() {
    this.platform.log.debug('createTVSpeakerService entered');
    const speakerService = this.accessory.getService(this.platform.Service.TelevisionSpeaker) ||
      this.accessory.addService(this.platform.Service.TelevisionSpeaker,
        this.accessory.context.device.displayName + ' Speaker');
    speakerService
      .setCharacteristic(
        this.platform.Characteristic.ConfiguredName,
        this.accessory.context.device.displayName + ' Speaker')
      .setCharacteristic(
        this.platform.Characteristic.Active,
        this.platform.Characteristic.Active.ACTIVE)
      .setCharacteristic(
        this.platform.Characteristic.VolumeControlType,
        this.platform.Characteristic.VolumeControlType.ABSOLUTE,
      );

    // handle volume control
    /* volume selector seems to be for the remote app?
    speakerService.getCharacteristic(this.platform.Characteristic.VolumeSelector)
      .on('set', this.setVolume.bind(this))
      .on('get', this.getVolume.bind(this));
    */
    speakerService.getCharacteristic(this.platform.Characteristic.Mute)
      .on('set', this.setMuted.bind(this))
      .on('get', this.getMuted.bind(this));
    speakerService.getCharacteristic(this.platform.Characteristic.Volume)
      .on('get', this.getVolume.bind(this))
      .on('set', this.setVolume.bind(this));
    this.service.addLinkedService(speakerService);
  }

  async getInputState(callback: CharacteristicGetCallback) {
    this.states.updates['SLI'] = true; // hack?
    this.sendCmd('SLIQSTN');
    // this.states.input = '00';
    this.platform.log.debug('getInputState entered');
    this.platform.log.debug(this.states.input);
    const input: Input|undefined = this.inputs[this.states.input];
    this.platform.log.debug('current input: ', input);

    if (!input) {
      return;
    }

    this.states.inputs.forEach((input, index) => {
      if (input.code === this.states.input) {
        return callback(null, index);
      } else {
        this.platform.log.debug('input.code: ', input.code, 'this.states.input: ', this.states.input);
      }
      return;
    });
  }

  updateInputs(response) {
    this.platform.log.debug('updateInputs entered');
    if (this.states.updates['SLI']) {
      this.platform.log.debug('response expected...');
      this.states.updates['SLI'] = false;
      this.states.input = response;
    } else {
      this.platform.log.debug('ignoring SLI message');
      this.platform.log.debug('response', response);
    }
  }

  async syncState() {
    // send id packet
    this.sendCmd('AMX');
    this.sendCmd('PWRQSTN');
    this.sendCmd('AMTQSTN');
    this.sendCmd('MVLQSTN');
    this.sendCmd('SLPQSTN');
    this.sendCmd('DIFQSTN');
    this.sendCmd('DIMQSTN');
    this.sendCmd('SLIQSTN');
    this.sendCmd('RESQSTN');
    this.sendCmd('TUNQSTN');
    this.sendCmd('PRSQSTN');
    this.platform.log.debug('Input: ', this.states.input);
  }

  async setInputState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('setInputState entered');
    // this.states.input = value.toString().padStart(2, '0');
    // get the ID?
    this.platform.log.debug('value: ', value);
    this.platform.log.debug('input code', this.states.inputs[value as number]);
    // const hexInput = this.states.input.toString(16).toUpperCase();
    this.states.input = this.states.inputs[value as number].code;
    this.sendCmd('SLI' + this.states.input);
    callback(null);
  }

  async createInputSourceServices() {
    // will need to add some input sources manually here...
    this.platform.log.debug('createInputSourceServices entered');
    this.states.inputs = [];
    let i = 0;
    for (const [key, value] of Object.entries(this.inputs)) {
      this.platform.log.debug('inputs: ', key, value);
      this.states.inputs.push({
        code: key,
        name: value,
        index: i,
      });
      i++;
    }
    this.platform.log.debug(JSON.stringify(this.states.inputs));

    this.states.inputs.forEach(input => {
      this.platform.log.debug('input: ', input);
      // check if it's been added already, e.g. from cache
      const uuid = this.platform.api.hap.uuid.generate(input.code + input.name);
      const inputService = this.accessory.getServiceById(uuid, input.name) ||
        this.accessory.addService(this.platform.Service.InputSource, uuid, input.name);

      inputService
        .setCharacteristic(this.platform.Characteristic.Identifier, input.index)
        .setCharacteristic(this.platform.Characteristic.Name, input.name)
        .setCharacteristic(
          this.platform.Characteristic.IsConfigured,
          this.platform.Characteristic.IsConfigured.CONFIGURED,
        )
        .setCharacteristic(
          this.platform.Characteristic.CurrentVisibilityState,
          this.platform.Characteristic.CurrentVisibilityState.SHOWN,
        )
        .setCharacteristic(
          this.platform.Characteristic.InputSourceType,
          this.platform.Characteristic.InputSourceType.APPLICATION,
        )
        .setCharacteristic(
          this.platform.Characteristic.InputDeviceType,
          this.platform.Characteristic.InputDeviceType.TV,
        );

      this.service.addLinkedService(inputService);
      this.inputServices.push(inputService);
    });
  }

  async setOn(state: CharacteristicValue, callback: CharacteristicSetCallback) {
    // implement your own code to turn your device on/off
    this.states.powerOn = state as boolean;

    if (this.states.powerOn) {
      this.platform.log.debug('Turning on...');
      this.sendCmd('PWR01');
    } else {
      this.platform.log.debug('Turning off...');
      this.sendCmd('PWR00');
    }

    this.platform.log.debug('Set Characteristic On ->', state);
    callback(null);
  }

  /**
   * Handle the 'GET' requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  isOnOff(response) {
    // parses the reponse and says whether it's on or off
    this.platform.log.debug('Processing PWR response');
    // sometimes this returns something besides 00 or 01 (N/A for example)
    if (response === '01') {
      this.states.powerOn=true;
    }
    if (response === '00') {
      this.states.powerOn=false;
    }
    this.platform.log.debug('powerOn set to ', this.states.powerOn);

  }

  getOn(callback: CharacteristicGetCallback) {
    // implement your own code to check if the device is on
    this.sendCmd('PWRQSTN');
    callback(null, this.states.powerOn);
    this.platform.log.debug('Get Characteristic On ->', this.states.powerOn);
  }

  isMuted(response) {
    this.platform.log.debug('Processing MUT response');
    if (response === '01') {
      this.states.isMuted=true;
    }
    if (response === '00') {
      this.states.isMuted=false;
    }
  }

  async getMuted(callback: CharacteristicGetCallback) {
    // check if the device is muted
    const isMuted = this.states.isMuted;
    this.sendCmd('AMTQSTN');
    this.platform.log.debug('Get Characteristic On ->', isMuted);
    callback(null, isMuted);
  }

  async setMuted(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('setMuted entered');
    this.states.isMuted = value as boolean;
    if (this.states.isMuted) {
      this.platform.log.debug('Muting...');
      this.sendCmd('AMT01');
    } else {
      this.platform.log.debug('Unmuting...');
      this.sendCmd('AMT00');
    }
    callback(null);

  }

  async getVolume(callback: CharacteristicGetCallback) {
    this.platform.log.debug('getVolume entered');
    this.sendCmd('MVLQSTN');
    const volume = this.states.volume;
    callback(null, volume);
    this.platform.log.debug('Get Characteristic Volume ->', volume);
    return volume;
  }

  updateVolume(response) {
    // handles packets returned from the volume master volume command
    this.platform.log.debug('handleVolume entered');
    const newVolume = parseInt(response, 16);
    this.platform.log.debug('response: ', newVolume);
    // this should create a percentage between min range / max range
    // e.g. if min is 20 and max is 70, then:
    // 20 + (50 * response / 100)
    // this is the actual volume on the amp
    const pct = (newVolume - this.minVolume) / (this.maxVolume - this.minVolume) * 100;
    // change this to a percent of 20..70
    this.platform.log.debug('pct: ', pct);
    this.states.volume = pct;
    this.platform.log.debug('new volume:', this.states.volume);
  }

  setVolume(newVolume: CharacteristicValue, callback: CharacteristicSetCallback) {
    // applies the configured volume
    // const newVolume = value as number;
    // can only do louder / softer
    /*
    if (direction === 0) {
      // volume up!
      newVolume += 5; // up it by 5%
    } else {
      newVolume -=5;
    }
    */
    newVolume = newVolume as number;
    this.platform.log.debug('newVolume: ', newVolume);
    if (newVolume > 100) {
      newVolume = 100;
    }
    if (newVolume < 0) {
      newVolume = 0;
    }
    this.platform.log.debug('Setting volume to', newVolume, '%');
    this.states.volume = newVolume;
    // calculate percent range
    const realVolume = Math.floor(this.minVolume + ((this.maxVolume - this.minVolume) * newVolume / 100));
    this.platform.log.debug('Setting real volume to', realVolume);
    // convert to hex
    const hexVolume = realVolume.toString(16).toUpperCase();
    this.sendCmd('MVL' + hexVolume);
    callback(null);
  }

  sendCmd(cmd) {
    // sends a command to the receiver
    const rawCmd = '!1' + cmd + '\r';
    this.platform.log.debug('sendCmd', rawCmd);
    this.port.write(rawCmd);
  }

  handleAnswer(data) {
    this.platform.log.debug('handleAnswer entered');
    this.platform.log.debug(data.toString('utf8'));
    const responseCommand = data.slice(2, 5).toString('utf8');
    const responseArgs = data.slice(5, 7).toString('utf8');
    this.platform.log.debug('Response command: %s', responseCommand);
    this.platform.log.debug('Response args: %s', responseArgs);

    switch (responseCommand) {
      case 'PWR':
        this.platform.log.debug('power response');
        this.isOnOff(responseArgs);
        break;
      case 'AMT':
        this.platform.log.debug('muting response');
        this.isMuted(responseArgs);
        break;
      case 'MVL':
        this.updateVolume(responseArgs);
        break;
      case 'SLI':
        this.platform.log.debug('input selector response');
        this.updateInputs(responseArgs);
        break;
      case 'AMX':
        this.platform.log.debug('identify packet response');
        this.platform.log.debug(data);
        break;
    }
  }

  /**
   * Handle 'SET' requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    // implement your own code to set the brightness
    this.states.brightness = value as number;

    this.platform.log.debug('Set Characteristic Brightness -> ', value);
  }

}
