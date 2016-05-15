---
title: "RealWorldWPDev Part 2: File &ndash;&gt; New Project"
disqus_identifier: http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-2-File-ndashgt-New-Project.aspx
redirect_from: /archive/2011/10/16/RealWorldWPDev-Part-2-File-ndashgt-New-Project.aspx/
tags: 
- wpdev
- realworldwpdev
header:
  teaser: subtext-content/www_matthidinger_com/Windows-Live-Writer/Real-world-Windows-Phone-File--New-Proje_11135/image_thumb.png
---
### Series Introduction and Outline

This series is going to walk through building a polished, functioning Windows Phone app from start to finish. The app is called Realworld Stocks and the [full source code will be available on CodePlex](http://realworldwpdev.codeplex.com/) as the series progresses. I’ll be using Mercurial to encourage forking and maybe even pull requests from developers who want to contribute their own real-world solutions.

[View the Series Introduction and Outline](http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-1-Introduction-and-Outline.aspx)
==============================================================================================================================================

Before you begin, install NuGet!
--------------------------------

[NuGet](http://nuget.org) is a Visual Studio extension that makes it easy to install and update open source libraries and tools in Visual Studio. It can be installed directly from within Visual Studio and only takes a minute.

In Visual Studio: Tools –&gt; Extension Manager and find NuGet

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Real-world-Windows-Phone-File--New-Proje_11135/image_thumb.png)


 
-

Defining our Solution Structure
-------------------------------

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Real-world-Windows-Phone-File--New-Proje_11135/image_thumb_5.png)
For our solution we are going to create 3 Client-side projects and 1 Server-side project. These projects are described below. The Solution Explorer to the right should help give you a sense of how our solution will start to develop, but for now, let’s just get the basics running.

### Creating the Windows Phone Projects

#### RealWorldStocks.Client.Core

***Windows Phone Class Library***

This project contains all of our core (non-UI) client-side functionality: Data Models, Helpers, HTTP Web Service clients, etc

####  

#### RealWorldStocks.Client.UI

***Windows Phone Application***

*References RealWorldStocks.Client.Core*

This project holds all UI-specific functionality for our application: Assets, Styles, ViewModels, Views (Pages and UserControls), etc

####  

#### RealWorldStocks.Client.BackgroundAgent

***Windows Phone Scheduled Task Agent***

*References RealWorldStocks.Client.Core*

The periodic task project that will eventually update our Live Tiles in the background every 30 minutes

###  

### Creating the Backend Services

#### RealWorldStocks.Web

***ASP.NET MVC 2 Application***

This project exposes our server side endpoints. I chose MVC for service simplicity; it’s very easy to create HTTP GET Routes with query string model binding and returning JSON out of the box.

###  

Run it!
-------

At this point we can F5 our project and marvel at our progress! In the next part we will start giving it some signs of life.

 

### Want some more RealWorldWPDev?

[View the Series Introduction and Outline](http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-1-Introduction-and-Outline.aspx)
==============================================================================================================================================



