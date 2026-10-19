---
title: Microwave
layout: hardware-project
permalink: /hardware/microwave/
order: 6
tour: 4
excerpt: This cabinet held a propane water heater that wasn’t marine safe. With an inverter on board, the space could take a microwave instead. A plywood floor fills the hole the heater sat in, varnished four coats, with a new cabinet door to match.
hardware:
  group: Boat
  sub: Propane water heater out, microwave in
  cover: done
  blurb: This cabinet held a propane water heater that wasn’t marine safe. With an inverter on board, the space could take a microwave instead. A plywood floor fills the hole the heater sat in, varnished four coats, with a new cabinet door to match.
  kit:
    - label: Microwave
      value: RCA
    - label: Removed
      value: Propane water heater
  compare:
    type: flip
    steps:
      - photo: before-wide
        caption: "Before: propane water heater"
      - photo: demo
        caption: Heater out
      - photo: patch
        caption: Patching the hole
      - photo: shelf
        caption: New shelf
      - photo: done
        caption: Microwave in
      - photo: door
        caption: With the cabinet door
  wiring:
    circuit: ac
    node: micro
    label: On the AC wiring diagram
  model:
    where: Galley
    system: electrical
    mode: ac
    pin: microwave
    tags: [ microwave, ac-panel, multiplus-inverter-charger, shore-power-inlet ]
  story:
    pull: 1.5
    views:
      galley:
        system: electrical
        mode: ac
        where: Galley
        also: [ microwave-shelf ]
        pin: microwave
        cam: [ 4.5, -1.6, 2 ]
        at: [ 6.4, 0.5, 1.05 ]
      ac:
        system: electrical
        mode: ac
        where: AC power
        cam: [ 4.2, -7.4, 4.2 ]
        at: [ 4, 0, 0.9 ]
    steps:
      - id: before-wide
        photo: before-wide
        caption: "Before: propane water heater"
        view: galley
        pin: microwave-shelf
        hide: [ microwave, microwave-shelf ]
      - id: demo
        photo: demo
        caption: Heater out
        view: galley
        pin: microwave-shelf
        hide: [ microwave, microwave-shelf ]
      - id: patch
        photo: patch
        caption: Patching the hole
        view: galley
        pin: microwave-shelf
        hide: [ microwave, microwave-shelf ]
      - id: shelf
        photo: shelf
        caption: New shelf
        view: galley
        pin: microwave-shelf
        hide: [ microwave ]
      - id: done
        photo: done
        caption: Microwave in
        view: galley
        about: [ microwave ]
      - id: door
        photo: door
        caption: With the cabinet door
        view: galley
      - id: galley
        photo: galley
        caption: Above the galley sink
        view: galley
      - id: power
        caption: Power from the inverter
        view: ac
        pin: null
        tags: [ shore-power-inlet, ac-panel, multiplus-inverter-charger, microwave ]
        text: With an inverter on board, the space could take a microwave.
---
