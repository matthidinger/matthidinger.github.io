---
title: Windlass
layout: hardware-project
permalink: /hardware/windlass/
order: 1
tour: 1
excerpt: There was no windlass before, just an anchor I had to raise by hand.
hardware:
  group: Boat
  sub: New windlass on the foredeck
  cover: final
  blurb: There was no windlass before, just an anchor I had to raise by hand.
  kit:
    - label: Windlass
      value: Maxwell RC10-8
      url: https://maxwellmarine.com/product/rc10/
  compare:
    type: flip
    steps:
      - photo: before
        caption: "Before: no windlass"
      - photo: old-out
        caption: Deck opened up
      - photo: core
        caption: Cut-out, filler on hand
      - photo: pad
        caption: Custom composite riser
      - photo: final
        caption: Done
  gallery:
    - photo: holes
      caption: Holes cut
    - photo: after-pair
      caption: Windlass and deck pipe
    - photo: locker
      caption: Below deck
  model:
    where: Bow
    system: tackle
    pin: windlass-gypsy
    pins: [ windlass-gypsy ]
    tags: [ windlass-gypsy, deck-switch, windlass-contactor, maxwell-breaker ]
  story:
    views:
      deck:
        system: all
        where: Foredeck
        pin: windlass-gypsy
        cam: [ 11.2, -2.6, 3.3 ]
        at: [ 8.5, 0, 1.6 ]
      below:
        system: tackle
        where: Below deck
        pin: windlass-motor
        cam: [ 9.9, -3.3, 1.9 ]
        at: [ 8, 0.35, 1.2 ]
    steps:
      - id: before
        photo: before
        caption: "Before: no windlass"
        view: deck
        pin: windlass-base
        hide: [ windlass-riser, windlass-base, windlass-gypsy, windlass-cap, windlass-motor ]
      - id: old-out
        photo: old-out
        caption: Deck opened up
        view: deck
        pin: windlass-base
        hide: [ windlass-riser, windlass-base, windlass-gypsy, windlass-cap, windlass-motor ]
      - id: holes
        photo: holes
        caption: Holes cut
        view: deck
        pin: windlass-base
        hide: [ windlass-riser, windlass-base, windlass-gypsy, windlass-cap, windlass-motor ]
      - id: core
        photo: core
        caption: Cut-out, filler on hand
        view: deck
        pin: windlass-base
        hide: [ windlass-riser, windlass-base, windlass-gypsy, windlass-cap, windlass-motor ]
      - id: pad
        photo: pad
        caption: Custom composite riser
        view: deck
        pin: windlass-riser
        hide: [ windlass-base, windlass-gypsy, windlass-cap ]
        about: [ windlass-riser ]
        text: I made a custom composite riser so the chain and rode sit high enough to clear the ledge along the boat’s exterior. I traced the windlass outline and added 1″ all the way round.
      - id: locker
        photo: locker
        caption: Below deck
        view: below
        about: [ windlass-motor ]
      - id: switch
        photo: switch
        caption: Switch in the old chain hole
        view: below
        pin: deck-switch
        about: [ deck-switch ]
        text: I reused the original anchor-chain hole as an access port. The Maxwell up/down switch sits just inside it.
        demo: anchor
        more:
          - photo: switch-below
            caption: From below
      - id: wiring
        photo: control
        caption: Switch, control unit and breaker
        view: below
        pin: null
        tags: [ deck-switch, windlass-contactor, maxwell-breaker ]
        about: [ deck-switch, windlass-contactor, maxwell-breaker ]
        text: The control unit sits in the forward cabinet.
      - id: after-pair
        photo: after-pair
        caption: Windlass and deck pipe
        view: deck
      - id: final
        photo: final
        caption: Done
        view: deck
        about: [ windlass-gypsy ]
---
