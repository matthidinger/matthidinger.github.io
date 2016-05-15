---
title: "RealWorldWPDev Part 1: Introduction and Outline"
disqus_identifier: http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-1-Introduction-and-Outline.aspx
redirect_from: /archive/2011/10/16/RealWorldWPDev-Part-1-Introduction-and-Outline.aspx/
tags: 
- wpdev
- realworldwpdev
header:
  teaser: subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-0_C07A/image29_thumb.png
---
### Series Introduction and Outline

This series is going to walk through building a polished, functioning Windows Phone app from start to finish. The app is called Realworld Stocks and the [full source code will be available on CodePlex](http://realworldwpdev.codeplex.com/) as the series progresses. I’ll be using Mercurial to encourage forking and maybe even pull requests from developers who want to contribute their own real-world solutions.

Realworld Stocks
----------------

The app we are creating is called Realworld Stocks, and this is what it looks like as of today. It’s not much yet, but hey, we’re only a few days in! Hopefully as the series progresses we’ll end up with a pretty nice looking stocks app ready for marketplace submission.

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-0_C07A/image29_thumb.png)
![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-0_C07A/image45_thumb.png)
![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-0_C07A/image53_thumb.png)
 

Series Outline
--------------

The following is a rough outline for how I expect this series to progress. Some parts will probably be added or removed (or broken out into smaller pieces). I will try really hard to write at least one post per week, so keep the pressure on if I start slacking!

1.  [Introduction and Outline (this post)](http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-1-Introduction-and-Outline.aspx)
2.  [File –&gt; New Project](http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-2-File-ndashgt-New-Project.aspx)
3.  [Caliburn.Micro and Application Infrastructure](http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-3-Caliburn-Micro-and-Application-Infrastructure.aspx)
4.  [The Panorama](http://www.matthidinger.com/archive/2011/10/21/RealWorldWPDev-Part-4-The-Panorama.aspx)
5.  [Creating and Consuming HTTP Web Services](http://www.matthidinger.com/archive/2011/11/01/RealWorldWPDev-Part-5-Creating-and-Consuming-Web-Services.aspx)
6.  [Page Navigation and Passing Complex State](http://www.matthidinger.com/archive/2011/12/04/RealWorldWPDev-Part-6-Page-Navigation-and-passing-Complex-State.aspx)
7.  State Management with ApplicationSettings and GlobalData
8.  Versioning Application settings when users upgrade
9.  Properly supporting Trial Mode
10. Creating Multiple Live Tiles
11. Updating tiles with Background Agents
12. Creating reusable Blend Behaviors
13. Polishing the User Input Experience
14. Creating an Announcements/News Page
15. Caching frequent images automatically into isolated storage
16. Submitting your App
17. Creating the global BusyIndictator *(new topic!)*
18. Creating re-usable and themable Controls *(new topic!)*
19. Controlling the AppBar from the ViewModel *(new topic!)*

### Extended Topics

The following parts will not apply to every app but are still worth posting about – most likely as an extended part of this series.

1.  Adding some serious polish with Telerik RadControls for Windows Phone
2.  Persisting certain models into a database on the server using EF 4.1 Code-first
3.  Updating the current location with a Caliburn.Micro UploadLocationResult
4.  MVVM Visual State Management
5.  Theming your image resources using OpacityMask (bad) or convert to a Path with a Brush (good)

Get the Source Code
-------------------

#### The full source code for this app will be be continuously updated on CodePlex at <http://realworldwpdev.codeplex.com>

There are 3 ways to get the source – the ideal way to keep updating as the app progresses would be to use TortoiseHg.

1.  [Browse the Source at CodePlex](http://realworldwpdev.codeplex.com/SourceControl/list/changesets)
2.  [Download the latest Source](http://realworldwpdev.codeplex.com/SourceControl/list/changesets)
3.  Use TortoiseHg to pull down and update to the latest source automatically

### Mercurial with TortoiseHg

At first a new source control product may seem like a burden, but TortoiseHg is a great product, extremely easy to pull from a repository, and if you feel like it, a great time to learn about DVCS.

For a great video tutorial on using Mercurial with CodePlex check out this [free Tekpub Production: Mercurial With Codeplex!](http://tekpub.com/view/dotnet-oss/7) The TortoiseHg UI in the video is slightly out of date now, but should still give you a great starting point!

1.  [Download TortoiseHg](http://tortoisehg.bitbucket.org/)
2.  In Windows Explorer, create a new folder where you want to download the source to
3.  Right click in the window, from TortoiseHg select **Clone…**

     ![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-0_C07A/SNAGHTML223cc484_thumb.png)


4.  Type the following Source **https://hg01.codeplex.com/realworldwpdev** **** and press **Clone**

    ![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-0_C07A/image_thumb_1.png)


5.  That’s it

####  

Special Thanks
--------------

The following people have contributed either directly or indirectly to this app and I’d like to offer a very special thanks to them!

Thanks [@Templarian](http://twitter.com/templarian) for the [iconography](http://templarian.com/project_windows_phone_icons/)!

Thanks [@JeffWilcox](http://twitter.com/jeffwilcox) for the [Samsung Focus Skin](http://www.jeff.wilcox.name/2011/04/focus-theme/)!

Thanks [@magnusvw](http://twitter.com/magnusvw) for connecting the backend to the Yahoo Finance API!

I hope everyone enjoys this series! Feedback always welcome!

 

