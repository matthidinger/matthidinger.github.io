---
title: "DynamicLocalhost NuGet Package for Windows Phone"
disqus_identifier: http://www.matthidinger.com/archive/2011/10/10/DynamicLocalhost-NuGet-Package-for-Windows-Phone.aspx
redirect_from: /archive/2011/10/10/DynamicLocalhost-NuGet-Package-for-Windows-Phone.aspx/
tags: 
- wpdev
- open-source
- community
- nuget
- powershell
- msbuild
---
Why?
----

### Because I should be able to Get Latest and F5!

I think simplicity is a crucial measure of success in all software. I think being able to pull down the source code onto any developer machine and F5 is an important goal to strive for. Removing manual processes and streamlining the development workflow can yield huge productivity gains – especially when onboarding new developers. I believe databases should be provisioned and seeded automatically, all 3rd party libraries should be readily available in the repo, and any manual steps that must be memorized or documented should be avoided at all costs.

### But this hasn’t been easy on a Windows Phone device

The aforementioned goals have been easily achievable in all of my projects except Windows Phone apps. A key component to this workflow is the magical variable known as **localhost**.

When I F5 one of my MVC apps the project launches a browser to **<http://localhost/MyProject>**.

When I F5 one of my Windows Phone apps in the emulator, it connects to my local IIS server at **<http://localhost/MyProject>**.

When I F5 one of my Winodws Phone apps on a real device, things go awry. Localhost on the phone does not point to my development box, naturally, it points back to itself. Thus the predicament.

### Let’s spike out a theory

Last night I had an idea, and decided to spike it out. What if I could store the URL to my Local IIS web services in a simple .txt file inside the XAP package? Then I could read this file during AppLaunch and store it for later. This part was easy, now for the magic. What if I could come up with a PreBuild step in Visual Studio, which could modify said .txt file during compile, and replace it’s contents with the Environment.MachineName? After a little fumbling around with a new Console Project, I had it working.

### NuGet, PowerShell, meet DynamicLocalhost

I’ve been a long-time fan of NuGet. I have seen some amazingly creative things done with it beyond just simple library dumps. [People much smarter than me](http://blog.stevensanderson.com/2011/01/13/scaffold-your-aspnet-mvc-3-project-with-the-mvcscaffolding-package/) are using PowerShell to create impressive scaffolding frameworks. Inspired, I cracked open my Windows PowerShell and MSBuild books and got to work.

I ended up building the following:

1.  No assembly dependencies, only a single source file and a single .txt file get added to your project
2.  Created a MSBuild Task which will process the LocalHostname.txt file and fill it with the Environment.MachineName
3.  Modify the .csproj file to add my custom BeforeBuild target, which executes the Task above on each compile, thus ensuring the text file always has the correct machine name

Ok that’s great, but how do I use it?
-------------------------------------

First you have to install the package. Make sure NuGet is installed.

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/DynamicLocalhost_132CE/image_thumb.png)


The rest is up to you, to use the DynamicLocalhost class however you see fit.

For me, in my WP7 projects I create a static ApplicationSettings class to use throughout the app. The comments below hopefully explain how it works. The only source code you ever check in says “localhost” – and will be dynamically replaced at compile-time to the actual developer’s machine name. This means that you are free to check in everything, get latest anytime you want, and never have to worry about someone accidently checking in their real machine’s URL, hampering your workflow.

 

```csharp
public static class ApplicationSettings
{
    public static string WebServiceBaseUrl { get; private set; }

    static ApplicationSettings()
    {
#if DEBUG
        // Compiling this app on MY machine, WebServiceBaseUrl will become: http://MATT-PC/RealWorldWP7.Web/
        // The returned URL will be automatically determined on each compile
        // Therefore no issues checking it in and getting latest on any developer machine
        WebServiceBaseUrl = DynamicLocalhost.ReplaceLocalhost("http://localhost/RealWorldWP7.Web/");
#else
        WebServiceBaseUrl = "http://services.mydomain.com/v1/";
#endif
    }
}
```

Source Code, Feedback, Forking!
-------------------------------

I would really, really love feedback on this. I scoured the internet trying to see if something similar already existed and turned up with nothing. If you find it useful, or have any suggestions, please be sure to let me know!

I’m also very new at PowerShell and would not be surprised if I wrote some of the worst .ps1 scripts ever. Any input by PowerShell guru’s would be most welcome.

[Get the Source!](http://dynamiclocalhost.codeplex.com/SourceControl/list/changesets)
-------------------------------------------------------------------------------------

It’s using Mercurial, so fork it, and be sure to send me pull requests if you write something awesome!

 

