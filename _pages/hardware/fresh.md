---
title: Fresh water
layout: hardware-project
permalink: /hardware/fresh/
order: 7
tour: 3
excerpt: Beckson inspection ports cut into both water tanks so they could be deep cleaned and disinfected from the inside, Veratron level sensors reporting over NMEA 2000, an Acuva ArrowMax UV purifier for drinking water at the galley, a whole-boat filter, new faucets, a transom washdown, a new vent on the aft tank and an IsoTemp water heater.
hardware:
  group: Boat
  sub: Clean tanks, level sensors, UV-filtered galley water
  cover: acuva
  blurb: Beckson inspection ports cut into both water tanks so they could be deep cleaned and disinfected from the inside, Veratron level sensors reporting over NMEA 2000, an Acuva ArrowMax UV purifier for drinking water at the galley, a whole-boat filter, new faucets, a transom washdown, a new vent on the aft tank and an IsoTemp water heater.
  kit:
    - label: Tank ports
      value: Beckson inspection ports
      url: https://www.beckson.com/dckplt.html
    - label: Tank sensors
      value: 2 × Veratron NMEA 2000 liquid level sensors
      url: https://veratron.com/products/nmea-2000%C2%AE-liquid-level-sensor-600mm
    - label: Tank gauge
      value: Veratron ViewLine Flex, in the DC panel
      url: https://veratron.com/products/vl-flex-52-nmea-2000-black
    - label: UV filter
      value: Acuva ArrowMax 2.0, under the galley sink
    - label: Pump
      value: Shurflo Aqua King II, in the head cabinet
      url: https://www.pentair.com/en-us/flow/shurflo/shurflo-products/shurflo-marine-applications/freshwater-washdown-systems/shurflo-aqua-king-ii-junior-standard-fresh-water-pumps.html
    - label: Filter
      value: Whole-boat filter and housing, beside the pump
    - label: Also
      value: Woder inline filter at the galley sink
    - label: Faucets
      value: Two new faucets
    - label: Washdown
      value: Jabsco washdown at the transom
    - label: Water heater
      value: IsoTemp, in the engine space
    - label: Tank vent
      value: New vent on the aft tank
  compare:
    type: flip
    steps:
      - photo: port-cut
        caption: Cutting an inspection port
      - photo: port
        caption: Port fitted
      - photo: sensor
        caption: Level sensor on the tank
      - photo: gauge
        caption: Tank gauge on N2K
      - photo: acuva
        caption: UV filter at the galley sink
  gallery:
    - photo: sensor-2
      caption: The other tank
    - photo: pump
      caption: Shurflo pump and whole-boat filter, head cabinet
    - photo: isotemp
      caption: IsoTemp water heater
    - photo: washdown
      caption: Washdown fitting at the transom
  model:
    where: Water tanks and galley
    system: plumbing
    also: [ tank-level-sensor, tank-gauge, inspection-port ]
    pin: acuva-uv-filter
    pins: [ acuva-uv-filter, tank-level-sensor ]
    tags:
      - water-tank-settee
      - water-tank-forward-berth
      - inspection-port
      - tank-gauge
      - pressure-pump
      - galley-faucet
  story:
    pull: 1.5
    views:
      tanks:
        system: plumbing
        where: Water tanks
        also: [ tank-level-sensor, tank-gauge, inspection-port, isotemp-water-heater, acuva-uv-filter ]
        cam: [ 5, -5.4, 3.7 ]
        at: [ 5.2, 0.6, 0.2 ]
      tank:
        system: plumbing
        where: One of the water tanks
        also: [ tank-level-sensor, tank-gauge, inspection-port, isotemp-water-heater, acuva-uv-filter ]
        pin: [ 3.4, 0.95, 0.22 ]
        cam: [ 5, -1.5, 1.9 ]
        at: [ 3.6, 0.9, 0.15 ]
      other:
        system: plumbing
        where: The other tank
        also: [ tank-level-sensor, tank-gauge, inspection-port, isotemp-water-heater, acuva-uv-filter ]
        pin: [ 6.94, 0.45, 0.28 ]
        cam: [ 8.3, -1.8, 1.9 ]
        at: [ 7.1, 0.45, 0.2 ]
      panel:
        system: plumbing
        where: DC panel
        also: [ tank-level-sensor, tank-gauge, inspection-port, isotemp-water-heater, acuva-uv-filter ]
        pin: tank-gauge
        cam: [ 4.4, -0.5, 1.5 ]
        at: [ 3.1, 1.1, 0.95 ]
      galley:
        system: plumbing
        where: Under the galley sink
        also: [ tank-level-sensor, tank-gauge, inspection-port, isotemp-water-heater, acuva-uv-filter ]
        pin: acuva-uv-filter
        cam: [ 4.6, -1, 1.6 ]
        at: [ 6.05, 0.75, 0.6 ]
      head:
        system: plumbing
        where: Head cabinet
        also: [ tank-level-sensor, tank-gauge, inspection-port, isotemp-water-heater, acuva-uv-filter ]
        pin: pressure-pump
        cam: [ 4.5, 0.7, 1.5 ]
        at: [ 5.2, -1.45, 0.4 ]
      heater:
        system: plumbing
        where: Engine space
        also: [ tank-level-sensor, tank-gauge, inspection-port, isotemp-water-heater, acuva-uv-filter ]
        pin: isotemp-water-heater
        cam: [ 3.2, -0.9, 1.5 ]
        at: [ 1.8, 0.7, 0.3 ]
      washdown:
        system: all
        where: Aft deck, at the transom
        pin: transom-shower
        cam: [ -0.9, -0.6, 2 ]
        at: [ -0.06, 0.35, 1.2 ]
    steps:
      - id: port-cut
        photo: port-cut
        caption: Cutting an inspection port
        view: tank
        hide: [ inspection-port, tank-level-sensor ]
        text: The inspection port gave a way in to deep clean the tank from the inside.
      - id: port
        photo: port
        caption: Port fitted
        view: tank
        hide: [ tank-level-sensor ]
        about: [ inspection-port ]
      - id: sensor
        photo: sensor
        caption: Level sensor on the tank
        view: tank
        pin: [ 3.88, 0.95, 0.23 ]
        about: [ tank-level-sensor ]
      - id: sensor-2
        photo: sensor-2
        caption: The other tank
        view: other
      - id: gauge
        photo: gauge
        caption: Tank gauge on N2K
        view: panel
        about: [ tank-gauge ]
      - id: gauge-panel
        photo: gauge-panel
        caption: Tank gauge in the DC panel
        view: panel
      - id: acuva
        photo: acuva
        caption: UV filter at the galley sink
        view: galley
        about: [ acuva-uv-filter ]
      - id: faucet
        photo: faucet
        caption: Galley faucet with the UV filter’s blue light
        view: galley
      - id: pump
        photo: pump
        caption: Shurflo pump and whole-boat filter, head cabinet
        view: head
        about: [ pressure-pump, water-filter ]
      - id: isotemp
        photo: isotemp
        caption: IsoTemp water heater
        view: heater
        about: [ isotemp-water-heater ]
      - id: washdown
        photo: washdown
        caption: Washdown fitting at the transom
        view: washdown
      - id: washdown-hose
        photo: washdown-hose
        caption: Washdown hose at the transom
        view: washdown
---
