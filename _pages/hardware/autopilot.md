---
title: Autopilot
layout: hardware-project
permalink: /hardware/autopilot/
order: 3
tour: 7
excerpt: A Raymarine linear drive below deck, on a block glassed to the hull, plus a rudder sensor, then calibrated.
hardware:
  group: Boat
  sub: Below-deck drive on the rudder
  cover: arm
  blurb: A Raymarine linear drive below deck, on a block glassed to the hull, plus a rudder sensor, then calibrated.
  kit:
    - label: Autopilot
      value: Raymarine Linear Drive
    - label: Also
      value: Rudder sensor
  compare:
    type: flip
    steps:
      - photo: bare
        caption: Bare hull
      - photo: pad
        caption: Plywood pad glassed in
      - photo: painted
        caption: Pad painted
      - photo: bracket
        caption: Mounting bracket
      - photo: arm
        caption: Tiller arm
      - photo: drive
        caption: Drive mounted
  model:
    where: Stern
    system: steering
    pin: linear-drive
    cam: [ -1.2, -1.6, 1.8 ]
    at: [ 0.6, 0.3, 0.5 ]
    tags: [ linear-drive, linear-drive-block, rudder-sensor, autopilot-acu ]
  story:
    pull: 1.3
    views:
      block:
        system: steering
        where: Below deck, inside the transom, starboard side
        pin: linear-drive-block
        cam: [ 0.4, -0.15, 0.75 ]
        at: [ -0.09, -0.47, 0.44 ]
      arm:
        system: steering
        where: On the rudder stock
        pin: tiller-arm
        cam: [ 0.26, 0.52, 0.87 ]
        at: [ 0.12, -0.1, 0.42 ]
      drive:
        system: steering
        where: Below deck, at the rudder
        pin: linear-drive
        cam: [ 0.47, 0.09, 0.91 ]
        at: [ 0.03, -0.45, 0.44 ]
      helm:
        system: steering
        where: Helm and engine room
        also: [ autopilot-control-p70s ]
        cam: [ 4.4, -3.6, 2.8 ]
        at: [ 1.3, 0.1, 0.8 ]
    steps:
      - id: bare
        photo: bare
        caption: Bare hull
        view: block
        pin: [ -0.14, -0.47, 0.44 ]
        hide: [ linear-drive-block, drive-bracket, tiller-arm, linear-drive, linear-drive-ram, drive-cable ]
      - id: pad
        photo: pad
        caption: Plywood pad glassed in
        view: block
        hide: [ drive-bracket, tiller-arm, linear-drive, linear-drive-ram, drive-cable ]
      - id: painted
        photo: painted
        caption: Pad painted
        view: block
        hide: [ drive-bracket, tiller-arm, linear-drive, linear-drive-ram, drive-cable ]
        about: [ linear-drive-block ]
      - id: bracket
        photo: bracket
        caption: Mounting bracket
        view: block
        pin: drive-bracket
        hide: [ tiller-arm, linear-drive, linear-drive-ram, drive-cable ]
      - id: arm
        photo: arm
        caption: Tiller arm
        view: arm
        hide: [ linear-drive, linear-drive-ram, drive-cable ]
      - id: drive
        photo: drive
        caption: Drive mounted
        view: drive
        about: [ linear-drive ]
      - id: connections
        caption: Sensor, brain and controls
        view: helm
        pin: null
        tags: [ linear-drive, rudder-sensor, autopilot-acu, autopilot-control-p70s ]
        about: [ rudder-sensor, autopilot-acu ]
        text: Then calibrated.
---
