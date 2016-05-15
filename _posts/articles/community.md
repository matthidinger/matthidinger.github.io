---
layout: page
title: "Community"
comments: true
disqus_identifier: http://www.matthidinger.com/archive/2011/07/24/community.aspx
redirect_from: /archive/2011/07/24/community.aspx/
tags: 
---
#### I’d love to speak to your audience!

Please be sure to [contact me](http://matthidinger.com/contact.aspx) if you’d like to schedule a talk for your user group, community event, or even a virtual gathering!

Chicagoland community
---------------------

If you’re into software development/architecture in Chicagoland I highly recommend the following groups and events:

[Chicago Windows Phone Developer Group](http://www.meetup.com/Chicago-Windows-Phone-Developers/)

[Chicago Code Camp](http://chicagocodecamp.com/) (yearly event)

[Chicago ALT.NET](http://chicagoalt.net/Home)

[Chicago Silverlight Users Group](http://chicagosilverlight.eventbrite.com/)

[Chicago IT Architects Group](http://www.chicagoarchitectsgroup.com/)

my talks
--------

Having attended the above user groups for a few years, in early 2010 I decided to try my hand at presenting on a few topics that were of interest to me. Below are the presentations I’ve given in the past.

 

View more [presentations](http://www.slideshare.net/) from [matthidinger](http://www.slideshare.net/matthidinger).

### Onion Architecture

Onion Architecture is a specific type of solution architecture that was first introduced to me by [Jeffrey Palermo](http://jeffreypalermo.com/blog/the-onion-architecture-part-1/). Over the years nearly every project I’ve worked on used a traditional layered architecture under the guise of loose coupling. Yet in every case as the project progressed we realized more and more that our layer abstractions weren’t actually abstractions at all. We were still building our application on top of a specific technology, which is sure to change over time. Additionally, when we needed to add a new feature to the UI, the developer is completely free to put the code for his feature in any layer he chooses — from the presentation layer on down, or perhaps in the dreaded “Shared/common/utility” project.

Onion architecture helps us fight this by enforcing true loose coupling. As you will see throughout the talk, our UI layer has no reference to any infrastructure/DAL, just the Core business logic. Even the business logic (Core) has no access to any infrastructure concerns. Rather than build on top of the database, it externalizes it. It defines what it needs using its own interfaces, and they are implemented as far outward as possible in Infrastructure. We then bind them together using an IoC container to bring the application to life.

#### Schedule

<table>
<colgroup>
<col width="50%" />
<col width="50%" />
</colgroup>
<tbody>
<tr class="odd">
<td>July 13, 2011</td>
<td><a href="http://chicagoalt.net/event/july-2011-meeting-onion-architecture-with-asp-net-mvc">Chicago ALT.NET User Group</a> <br />
233 S Wacker Dr, Suite 750<br />
Chicago, IL 60606<br />
<br />
</td>
</tr>
<tr class="even">
<td>May 14, 2011</td>
<td><a href="http://chicagocodecamp.com/sessions/28">Chicago Code Camp</a><br />
College of Lake County
<p>19351 W. Washington Str.<br />
Grayslake, IL 60030-1198</p></td>
</tr>
<tr class="odd">
<td>April 15, 2010</td>
<td><a href="http://chicagoarchitectsgroup.com/Meetings.aspx?mid=18">Chicago IT Architects Group</a><br />

<p>200 S Wacker Drive, Suite 1500<br />
Chicago, IL 60606</p></td>
</tr>
</tbody>
</table>

### Windows Phone MVVM with Caliburn.Micro

Get started developing Windows Phone applications using the popular Caliburn.Micro framework by Rob Eisenburg. Caliburn.Micro is an open source, lightweight MVVM framework that works for Silverlight, WPF, and WP7. It offers phone developers many helpful infrastructure features for managing tombstoning, IoC, and advanced XAML-based data binding and commanding. Developed with a lightweight footprint and backed by a thriving community, CM and WP7 offer developers a great platform for real-world applications.

#### Schedule

<table>
<colgroup>
<col width="50%" />
<col width="50%" />
</colgroup>
<tbody>
<tr class="odd">
<td>July 27, 2011</td>
<td><a href="http://windowsphonetechweek.eventbrite.com/">Windows Phone Unleashed @ TechWeek</a><br />

<p>Microsoft Office @ AON Center<br />
200 E Randolph<br />
Chicago, IL 60617</p></td>
</tr>
<tr class="even">
<td>March 14, 2011</td>
<td><a href="http://www.meetup.com/Chicago-Windows-Phone-Developers/events/16679113/">Chicago Windows Phone Developer Group</a><br />

<p>200 S Wacker Drive, Suite 1500<br />
Chicago, IL 60606</p></td>
</tr>
</tbody>
</table>

Podcasts
--------

### [Building CTA Watch on Developer Smackdown](http://developersmackdown.com/archives/show/53)

In July of 2011 I was invited onto the [Developer Smackdown](http://developersmackdown.com/archives/show/53) podcast to muse about my adventures in Windows Phone development.

> In this show, Mark and Clark sit down with Matt Hidinger and talk about building his app CTA Watch for Windows Phone 7. Matt discusses his experiences over this past year and shares a great deal of passion about the platform.

|                                                                                                                                                               |                                                                                                                                                                                         |                                                                                                                                                                                             |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [![Zune.net](http://social.zune.net/xweb/zune/argoV2/images/ZuneLogo.gif)](http://social.zune.net/podcast/The-Smackdown/dc0d78a9-8d5d-4fb4-b205-1491945cab7c) | [<img src="http://www.rechargebiomedical.com/blog/wp-content/uploads/2011/02/itunes_logo1.jpg" width="84" height="33" />](http://itunes.apple.com/us/podcast/the-smackdown/id331905132) | [<img src="http://a4.mzstatic.com/us/r30/Podcasts/d5/69/49/ps.jbzitkii.170x170-75.jpg" alt="Developer Smackdown" width="84" height="37" />](http://developersmackdown.com/Archives/Show/53) |
| [Get it on Zune](http://social.zune.net/podcast/The-Smackdown/dc0d78a9-8d5d-4fb4-b205-1491945cab7c)                                                           | [Get it on iTunes](http://itunes.apple.com/us/podcast/the-smackdown/id331905132)                                                                                                        | [Stream it from the web](http://developersmackdown.com/Archives/Show/53)                                                                                                                    |



