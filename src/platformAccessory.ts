import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { OnkyoSerialHomebridgePlatform } from './platform';

import Delimiter = require('@serialport/parser-delimiter')


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class OnkyoSerialPlatformAccessory {
  private service: Service;
  private televisionService: Service;
  private speakerService: Service;
  private port;
  private parser;
  private muter;
  private maxVolume = 70;
  private minVolume = 0;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  
  private states = {
    powerOn: false,
    volume: 0,
    isMuted:false,
    brightness: 0,
    input: 0
  }
   
  private exampleStates = {
    On: false,
    Brightness: 100,
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
    this.platform.log.debug(JSON.stringify(this.platform.connections));
    this.port = this.platform.connections[accessory.context.device.path];
    
    // create a delimiter parser of 1a
    this.parser = this.port.pipe(new Delimiter({delimiter: [0x1a]}));
    this.parser.on("data", this.handleAnswer.bind(this));

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below
    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setVolume.bind(this));       // SET - bind to the 'setBrightness` method below
    // try to create a volume knob
    /*
    this.muter = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.displayName + " Mute", 'muter');
    this.muter 
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setMuted.bind(this))
        .onGet(this.getMuted.bind(this));
        /*
        .on('get', callback => {
                this.getMuted((error, value) {
                  if (error) {
                    callback(error);
                    return;
                  }
                  callback(null, !value);
                });
         })
         .on('set', (value, callback) => this.setMuted(!value, callback));
         */
    /*
    this.dimmer
         .addCharacteristic(Characteristic.Brightness)
         .on('get', this.getVolumeState.bind(this))
         .on('set', this.setVolumeState.bind(this));
    */
    
    // this.service.addLinkedService(this.muter);
    
    // try to add the spekaer service?
    
    this.televisionService = new this.platform.Service.Television(this.accessory.context.device.displayName, 'televisionService');
    this.televisionService.setCharacteristic(this.platform.Characteristic.ConfiguredName, "TV LOL");
    
    /*
    this.televisionService = this.accessory.getService(this.platform.Service.Television) || 
      this.accessory.addService(this.platform.Service.Television,  accessory.context.device.displayName + 'televisionService');
    this.televisionService.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.context.displayName + " TV");
    
    // this.televisionService.setCharacteristic(this.platform.Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
    */    
    this.televisionService.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

    this.platform.log.debug("Adding speaker service");

    this.speakerService = this.accessory.getService(this.platform.Service.TelevisionSpeaker) || this.accessory.addService(this.platform.Service.TelevisionSpeaker, accessory.context.device.displayName + " Speaker")
    this.speakerService
      .setCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.ACTIVE)
      .setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.ABSOLUTE);
    this.speakerService.getCharacteristic(this.platform.Characteristic.Volume)
      .onSet(this.setVolume.bind(this))
      .onGet(this.getVolume.bind(this))
    this.speakerService
      .setCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.ACTIVE)
      .setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.ABSOLUTE);
    this.speakerService.getCharacteristic(this.platform.Characteristic.Mute)
      .onSet(this.setMuted.bind(this))
      .onGet(this.getMuted.bind(this));

    this.speakerService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName + " Speaker");
  
    this.televisionService.addLinkedService(this.speakerService);          

    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    // Example: add two "motion sensor" services to the accessory
    /*
    const motionSensorOneService = this.accessory.getService('Motion Sensor One Name') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1');

    const motionSensorTwoService = this.accessory.getService('Motion Sensor Two Name') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2');
      */

    /**
     * Updating characteristics values asynchronously.
     *
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     *
     */
     
    /*
    let motionDetected = false;
    setInterval(() => {
      // EXAMPLE - inverse the trigger
      motionDetected = !motionDetected;

      // push the new value to HomeKit
      motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected);
      motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected);

      this.platform.log.debug('Triggering motionSensorOneService:', motionDetected);
      this.platform.log.debug('Triggering motionSensorTwoService:', !motionDetected);
    }, 10000);
    */
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    this.states.powerOn = value as boolean;
    
    if (this.states.powerOn) {
      this.platform.log.debug("Turning on...");
      this.sendCmd("PWR01");
    } else {
      this.platform.log.debug("Turning off...");
      this.sendCmd("PWR00");
    }
    
    this.platform.log.debug('Set Characteristic On ->', value);
  }

  /**
   * Handle the "GET" requests from HomeKit
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
    this.platform.log.debug("Processing PWR response")
    // sometimes this returns something besides 00 or 01 (N/A for example)
    if (response == "01") { this.states.powerOn=true };
    if (response == "00") { this.states.powerOn=false}
    this.platform.log.debug("powerOn set to ", this.states.powerOn);
    
  }
  
  async getOn(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    const isOn = this.states.powerOn;

    this.sendCmd("PWRQSTN");
    
    this.platform.log.debug('Get Characteristic On ->', isOn);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return isOn;
  }
  
  isMuted(response) {
    this.platform.log.debug("Processing MUT response");
    if (response == "01") { this.states.isMuted=true};
    if (response == "00") { this.states.isMuted=false};
  }
  
  async getMuted(): Promise<CharacteristicValue> {
    // check if the device is muted
    const isMuted = this.states.isMuted;
    this.sendCmd("AMTQSTN");
    this.platform.log.debug("Get Characteristic On ->", isMuted);
    return isMuted;
  }

  async setMuted(value: CharacteristicValue) {
    this.states.isMuted = value as boolean
    if (this.states.isMuted) {
      this.platform.log.debug("Muting...");
      this.sendCmd("AMT01");
    } else {
      this.platform.log.debug("Unmuting...");
      this.sendCmd("AMT00");
    }
    
  }

  async getVolume(): Promise<CharacteristicValue> {
    this.platform.log.debug("getVolume entered");
    this.sendCmd("MVLQSTN");
    const volume = this.states.volume;
    this.platform.log.debug("Get Characteristic Volume ->", volume);
    return volume
  }

  updateVolume(response) {
    // handles packets returned from the volume master volume command
    this.platform.log.debug("handleVolume entered");
    var newVolume = parseInt(response, 16);    
    this.platform.log.debug("response: ", newVolume);
    // this should create a percentage between min range / max range
    // e.g. if min is 20 and max is 70, then:
    // 20 + (50 * response / 100)
    // this is the actual volume on the amp
    var pct = (newVolume - this.minVolume) / (this.maxVolume - this.minVolume) * 100;
    // change this to a percent of 20..70
    this.platform.log.debug("pct: ", pct);
    this.states.volume = pct;
    this.platform.log.debug("new volume:", this.states.volume);    
  }
  
  async setVolume(value: CharacteristicValue) {
    // applies the configured volume
    var newVolume = value as number;
    this.platform.log.debug("Setting volume to", newVolume, "%");
    this.states.volume = newVolume;
    // calculate percent range
    var realVolume = Math.floor(this.minVolume + ((this.maxVolume - this.minVolume) * newVolume / 100));
    this.platform.log.debug("Setting real volume to", realVolume);
    // convert to hex
    var hexVolume = realVolume.toString(16).toUpperCase();
    this.sendCmd("MVL" + hexVolume);
    
  }

  sendCmd(cmd) {
    // sends a command to the receiver
    var rawCmd = "!1" + cmd + "\r";
    this.platform.log.debug("sendCmd", rawCmd);
    this.port.write(rawCmd);
  }

  handleAnswer(data) {
    this.platform.log.debug('handleAnswer entered')
    this.platform.log.debug(data.toString("utf8"));;
    var responseCommand = data.slice(2,5).toString("utf8");
    var responseArgs = data.slice(5,7).toString("utf8");
    this.platform.log.debug("Response command: %s", responseCommand);
    this.platform.log.debug("Response args: %s", responseArgs);
    

    
    switch (responseCommand) {
      case "PWR":
        this.platform.log.debug("power response");
        this.isOnOff(responseArgs);
        break;
      case "AMT":
        this.platform.log.debug("muting response");
        this.isMuted(responseArgs);
        break;
      case "MVL":
        this.updateVolume(responseArgs);
        break;
    }
    
    
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    // implement your own code to set the brightness
    this.states.brightness = value as number;

    this.platform.log.debug('Set Characteristic Brightness -> ', value);
  }

}
