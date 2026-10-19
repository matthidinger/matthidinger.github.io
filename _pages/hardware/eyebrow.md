---
title: Eyebrow
layout: hardware-project
permalink: /hardware/eyebrow/
order: 4
tour: 2
excerpt: The “eyebrow” is that strip of 35 year old wood along the cabin top. It looks fine from a distance but it was crumbling up close. Time to remove it, patch the holes, replace with a navy vinyl stripe, and never have to maintain it again
hardware:
  group: Boat
  sub: Wood trim off, navy vinyl stripe on
  cover: wide
  blurb: The “eyebrow” is that strip of 35 year old wood along the cabin top. It looks fine from a distance but it was crumbling up close. Time to remove it, patch the holes, replace with a navy vinyl stripe, and never have to maintain it again
  kit:
    - label: Stripe
      value: Navy vinyl
  compare:
    type: flip
    steps:
      - photo: before
        caption: Before
      - photo: crumbling
        caption: Crumbling up close
      - photo: removed
        caption: Coming off
      - photo: old-wood
        caption: What came off
      - photo: patched
        caption: Holes patched
      - photo: final
        caption: Navy vinyl stripe
  gallery:
    - photo: after
      caption: Wood gone, before the stripe
  model:
    where: Cabin sides
    system: all
    pin: eyebrow-stripe
    cam: [ 7.4, 5.9, 3 ]
    at: [ 4.4, 0.8, 1.4 ]
    tall:
      cam: [ 8.6, 7.4, 3.6 ]
      at: [ 4.4, 0.8, 1.4 ]
    tags: [ eyebrow-stripe ]
  story:
    views:
      deck:
        system: all
        where: Port side deck, looking aft
        pin: [ 4.2, 1.11, 1.53 ]
        cam: [ 7.3, 1.75, 2.25 ]
        at: [ 3.6, 1, 1.45 ]
      side:
        system: all
        where: Port cabin side
        pin: [ 5.4, 1.11, 1.48 ]
        cam: [ 6.4, 5.4, 2.6 ]
        at: [ 4.5, 0.8, 1.4 ]
    steps:
      - id: before
        photo: before
        caption: Before
        view: deck
        hide: [ eyebrow-stripe, sail ]
      - id: crumbling
        photo: crumbling
        caption: Crumbling up close
        view: deck
        hide: [ eyebrow-stripe, sail ]
      - id: removed
        photo: removed
        caption: Coming off
        view: deck
        hide: [ eyebrow-stripe, sail ]
      - id: old-wood
        photo: old-wood
        caption: What came off
        view: deck
        pin: null
        hide: [ eyebrow-stripe, sail ]
      - id: patched
        photo: patched
        caption: Holes patched
        view: deck
        hide: [ eyebrow-stripe, sail ]
      - id: after
        photo: after
        caption: Wood gone, before the stripe
        view: deck
        hide: [ eyebrow-stripe, sail ]
      - id: final
        photo: final
        caption: Navy vinyl stripe
        view: side
        hide: [ sail ]
        about: [ eyebrow-stripe ]
---
