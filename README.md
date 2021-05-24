
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

[![Node.js Package](https://github.com/rubeon/homebridge-onkyo-serial/actions/workflows/release.yml/badge.svg)](https://github.com/rubeon/homebridge-onkyo-serial/actions/workflows/release.yml)
[![Build and Lint](https://github.com/rubeon/homebridge-onkyo-serial/actions/workflows/build.yml/badge.svg)](https://github.com/rubeon/homebridge-onkyo-serial/actions/workflows/build.yml)



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

## Troubleshooting

* Make sure that the user id running `homebridge` has access to the serial
  port being used.

Under ubuntu, homebridge is running under the `homebridge` user, and can be
given access with the following command:

```
sudo gpasswd -a homebridge dialout
```

