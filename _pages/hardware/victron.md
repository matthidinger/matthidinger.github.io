---
title: Victron lithium upgrade
layout: hardware-project
permalink: /hardware/victron/
order: 8
tour: 5
hardware:
  group: Boat
  sub: 2 × 330 Ah lithium, MultiPlus 2000W, Cerbo GX, Orion-TR DC-DC
  cover: panel
  wiring:
    label: Wiring diagram
  model:
    where: Electrical
    system: electrical
    mode: dc
    pin: multiplus-inverter-charger
    tags:
      - house-battery-1-330ah-lifepo4
      - multiplus-inverter-charger
      - cerbo-gx
      - orion-dc-dc-charger
      - class-t-fuse
      - shunt
  story:
    views:
      bank:
        system: electrical
        mode: dc
        where: Under the cockpit
        cam: [ 2.9, -2.4, 1.5 ]
        at: [ 0.9, 0, 0.15 ]
      protect:
        system: electrical
        mode: dc
        where: Under the cockpit
        cam: [ 2.6, -1.9, 1.2 ]
        at: [ 1.05, 0, 0.25 ]
      bulkhead:
        system: electrical
        mode: dc
        where: Engine-room bulkhead
        cam: [ 4.6, 0.4, 1.6 ]
        at: [ 2.58, -1.2, 0.8 ]
      orion:
        system: electrical
        mode: dc
        where: Under the cockpit
        cam: [ 2.3, -2.3, 1.3 ]
        at: [ 0.6, -0.5, 0.3 ]
      panel:
        system: electrical
        mode: dc
        where: By the panels
        cam: [ 4.6, -0.6, 1.5 ]
        at: [ 2.9, 1.1, 0.95 ]
    steps:
      - id: bank
        photo: bank
        caption: Two 330 Ah lithium batteries
        view: bank
        pin: null
        tags: [ house-battery-1-330ah-lifepo4, house-battery-2-330ah-lifepo4 ]
        about: [ house-battery-1-330ah-lifepo4 ]
      - id: protect
        photo: protect
        caption: Fuse, shunt and switch
        view: protect
        pin: null
        tags: [ class-t-fuse, shunt, battery-switch, busbars-lynx ]
        about: [ class-t-fuse, shunt ]
        text: 300 A Class T fuse.
      - id: multiplus
        photo: multiplus
        caption: MultiPlus 2000W and Cerbo GX
        view: bulkhead
        pin: null
        tags: [ multiplus-inverter-charger, cerbo-gx, battery-bms, batteryprotect, balmar-regulator ]
        about: [ multiplus-inverter-charger, cerbo-gx ]
        more:
          - photo: bms
            caption: VE.Bus BMS and Balmar regulator
      - id: batteryprotect
        photo: batteryprotect
        caption: Smart BatteryProtect on the house feed
        view: bulkhead
        pin: null
        tags: [ batteryprotect ]
        about: [ batteryprotect ]
      - id: orion
        photo: orion
        caption: Orion-TR DC-DC to the start battery
        view: orion
        pin: null
        tags: [ orion-dc-dc-charger, start-battery-group-24-agm ]
        about: [ orion-dc-dc-charger ]
      - id: panel
        photo: panel
        caption: GX Touch and the panels
        view: panel
        pin: null
        tags: [ gx-touch, dc-panel, ac-panel ]
        about: [ gx-touch ]
      - id: safetyhub
        photo: safetyhub
        caption: SafetyHub 150 behind the DC panel
        view: panel
        pin: null
        tags: [ safetyhub-150-fuse-block ]
        about: [ safetyhub-150-fuse-block ]
---
