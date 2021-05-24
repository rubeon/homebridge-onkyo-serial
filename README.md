
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# Onkyo AVR Serial Homebridge Platform Plugin

This plugin allows Homebridge to manage an Onkyo receiver via an RS-232 serial
ports and publish it Apple Homekit. Supported models should include any
receiver that conforms to the [ISCP
protocol]().

Tested models include:

- TX-SR706
## Installation

You can install the plugin by running:

```
npm install -g homebridge-plugin-onkyo-serial
```

## Configuration

Enable the plugin by adding the following to your homebridge's config.json:

```
    "platforms": [
	...
        {
            "platform": "OnkyoSerial",
            "paths": ["/dev/ttyS0"]
        }
    ]
```

