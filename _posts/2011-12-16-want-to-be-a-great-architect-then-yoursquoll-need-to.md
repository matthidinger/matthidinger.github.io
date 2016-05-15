---
title: "Want to be a great architect? Then you&rsquo;ll need to be a great salesman"
disqus_identifier: http://www.matthidinger.com/archive/2011/12/16/want-to-be-a-great-architect-then-yoursquoll-need-to.aspx
redirect_from: /archive/2011/12/16/want-to-be-a-great-architect-then-yoursquoll-need-to.aspx/
tags: 
- opinions
- speaking
- career
- architecture
---
![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Want-to-be-a-great-architect-be-a-great-_860E/vincefromshamwow_thumb.jpg)

The title is slightly tongue-in-cheek, but I do believe selling is a crucial aspect of being an ‘architect.’ And I don’t mean selling to customers.

But first, a backstory
----------------------

A long time ago, at a client far, far away… they were making a big push to SOA. My project at the time was calling a few methods from a referenced assembly, but the client’s architect said I must re-write it using their new WCF endpoint instead. I had my reservations about this change because the services so far were not known to be stable nor discoverable. Now I am certainly no expert at applying SOA, but I do appreciate that it consists of more than simply exposing everything through web services.

In my mind, before even *attempting* to impose an SOA mandate across an enterprise you must establish some baseline infrastructure:

1.  A **central service registry** that lists all available services and their endpoints for various configurations (Integration, QA, Prod)
2.  A **heartbeat service** monitoring each endpoint so developers don’t waste time relying on a specific service that isn’t available
3.  An enforced protocol that all **developers must list any new services on the registry** and ensure that heartbeats are setup before signing off

Of course this list is not exhaustive nor even proposed solutions – but they are a few concerns I had during my re-write. The endpoint I was given was under active development and highly unstable; while the referenced assembly I used was rock solid and had existed for years. A lot of time and money were wasted throughout this process. While I can absolutely appreciate the need for standardization, this felt a lot like putting the cart before the horse: the necessary baseline components to make this SOA transition even remotely efficient had not been established. As I was starting to raise these concerns up the chain, I got…

#### The No-Time Justification

\[While this story is purely anecdotal I want to be perfectly clear that the subsequent dialog is hearsay, although we’ve all no doubt been in similar situations.\]

I started discussing these concerns with a coworker, and he assured me that the architect is aware of the problems. So the story goes, **he was not given the time nor resources to have his plan fully executed**. Of course I can appreciate that sometimes there really is no time, but converting an enterprise to SOA should not be some snap decision made without careful consideration.

One could argue that the wasted effort these teams were suffering is the fault of management not allocating the proper resources, **but perhaps some of the fault lies on not effectively selling the importance of this plan to management.**

Sell your plan
--------------

In my mind being an architect (or team lead, or technical lead, or whatever your title may be) is not only about coming up with a plan, but being able to sell that plan to peers and as well as superiors.

#### Sell your plan to management

As in the anecdote above, the time will come when you may need extra time or resources to execute your plan. This means preparing for a certain kind of debate: a targeted discussion with people concerned with budgets and finances, not curly braces and semi-colons. This means preparing a cost/benefit analysis if applicable: **doing this will save us X time or money, failing to do so will cost us X over Y months until corrected**. You must be able to articulate clearly that this is not some grandiose gold-plating pie-in-the-sky need. If it’s important and will reduce developer friction while saving the company money then be prepared to argue that effectively.

#### Sell your plan to the team

It’s equally important to get your team on board. Don’t be an [Ivory Tower Architect](http://igloocoder.com/archive/2009/04/01/ivory-tower-architect.aspx). You are still a part of the team (or many teams). Don’t just swoop into meetings, impose your will, and avoid implementing the architecture you’ve laid out. Let your team contribute to the discussion and decisions; you are not infallible. This means being able to address concerns directly and intelligently, **especially when they don’t align with your beliefs.** This means proving that you have considered alternatives and are prepared to have a rational debate on them. This also means having at least cursory knowledge of a number of technologies, patterns, strategies, and platforms.

I understand at the end of the day work needs to get done and us technologists can debate for weeks on something as simple as Hungarian notation, so you’ll still need to use your best judgment when a topic should be put to rest and the team needs to move on.

#### Sell your plan in terms your audience can understand

Did you notice the huge differences between the two types of meetings above? It’s important to prepare the correct type of material tailored for the audience at hand.

Which brings me to…

My advice: Public Speaking
--------------------------

I can say without a doubt the largest contributors to my professional growth have come from blogging and speaking. If you’re up for it, I highly recommend giving it a shot because…

1.  **It builds confidence by putting your material and yourself out there.** It’s no secret that being confident in what you’re selling makes it exponentially easier.
2.  **It forces you to truly prepare and attempt to master subject material.** Hopefully this also means diving into alternative solutions, to ensure that you have indeed made the best possible decision at the time.
3.  **It forces you to answer questions on the spot, in front of an audience.** These are the very same types of questions you’ll get from your team and your management. “Because I say so” isn’t going to fly during a talk, and it shouldn’t fly in a meeting at work.

Since I’m absolutely no expert at public speaking, if it’s something you’re interested in then you should definitely check out this TekPub production:

#### [The Art of Speaking: Scott Hanselman](http://tekpub.com/hanselman "http://tekpub.com/hanselman")

Summary
-------

I don’t often write opinion pieces on this blog, mostly because I am still learning every day, and will probably look back on this post a year from now and think these are absurd suggestions. In any event, the following Five Whys blog has some pretty helpful advice, and the book Code Leader I read a few years ago had some nice insight for an aspiring tech lead like myself.

Blog: [Five Whys - Team Leadership](http://5whys.com/ "http://5whys.com/")

Book: [Code Leader: Using People, Tools, and Processes to Build Successful Software](http://www.amazon.com/Code-Leader-Processes-Successful-Programmer/dp/0470259248 "http://www.amazon.com/Code-Leader-Processes-Successful-Programmer/dp/0470259248")

 

