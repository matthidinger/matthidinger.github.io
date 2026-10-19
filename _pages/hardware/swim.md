---
title: Swim platform
layout: hardware-project
permalink: /hardware/swim/
order: 2
tour: 8
excerpt: The platform’s bolts landed right where the autopilot’s linear drive block sits inside, so I had to build a custom mount to work around it. Then epoxy-fill every hole I drilled.
hardware:
  group: Boat
  sub: Swim platform on the transom
  cover: main
  blurb: The platform’s bolts landed right where the autopilot’s linear drive block sits inside, so I had to build a custom mount to work around it. Then epoxy-fill every hole I drilled.
  compare:
    type: flip
    steps:
      - photo: before
        caption: "Before: boarding ladder"
      - photo: mockup
        caption: Mock-up on the hard
      - photo: drilled
        caption: Drilling the transom
      - photo: mount
        caption: Bracket mounts
      - photo: main
        caption: Done
  gallery:
    - photo: dock
      caption: At the dock
  model:
    where: Transom
    system: all
    pin: swim-platform
    cam: [ -4.3, 2.5, 1.5 ]
    at: [ -0.25, 0.05, 0.45 ]
    tall:
      cam: [ -6.2, 3.3, 2.1 ]
      at: [ -0.25, 0.05, 0.5 ]
    tags: [ swim-platform, transom-shower ]
  story:
    views:
      outside:
        system: all
        where: Transom
        pin: swim-platform
        cam: [ -4.3, 2.5, 1.5 ]
        at: [ -0.25, 0.05, 0.45 ]
      close:
        system: all
        where: Transom
        pin: swim-platform
        cam: [ -2.6, -1.5, 1.2 ]
        at: [ -0.2, -0.35, 0.5 ]
      inside:
        system: steering
        where: Inside the transom
        also: [ swim-platform ]
        cam: [ 2.2, -2.1, 1.5 ]
        at: [ -0.1, -0.45, 0.35 ]
    steps:
      - id: before
        photo: before
        caption: "Before: boarding ladder"
        view: outside
        pin: transom
        hide: [ swim-platform ]
      - id: mockup
        photo: mockup
        caption: Mock-up on the hard
        view: outside
      - id: conflict
        caption: "In the way: the autopilot block"
        view: inside
        pin: null
        tags: [ linear-drive-block, swim-platform ]
        about: [ linear-drive-block ]
        text: The platform’s bolts landed right where the autopilot’s linear drive block sits inside, so I had to build a custom mount to work around it.
      - id: drilled
        photo: drilled
        caption: Drilling the transom
        view: close
        pin: transom
        hide: [ swim-platform ]
        text: Then epoxy-fill every hole I drilled.
      - id: mount
        photo: mount
        caption: Bracket mounts
        view: close
      - id: main
        photo: main
        caption: Done
        view: outside
        about: [ swim-platform ]
      - id: dock
        photo: dock
        caption: At the dock
        view: outside
---
