---
title: "Fixing Web Application Projects with automated TFS Builds"
disqus_identifier: http://www.matthidinger.com/archive/2008/11/09/fixing-web-application-projects-with-automated-tfs-builds.aspx
redirect_from: /archive/2008/11/09/fixing-web-application-projects-with-automated-tfs-builds.aspx/
tags: 
- aspnet
- tfs
- ci
- aspnet-mvc
---
This weekend I started playing with Automated Builds in TFS 2008. Over the next few weeks I am going to setup automated builds for my various projects so I can start running automated integration testing and automated staging releases at certain intervals (nightly, weekly, etc). Unfortunately I hit a snag when I tried building one of my solutions that contained a Web Application Project.

![](/images/subtext-content/FixingWebApplicationProjectswithautomate_B396/image_thumb.png)


After some digging around, I eventually opened up the “Release.txt” log file which can be found in the deployment directory, I found the following error:

> error MSB4019: The imported project "C:\\Program Files\\MSBuild\\Microsoft\\VisualStudio\\v9.0\\WebApplications\\Microsoft.WebApplication.targets" was not found. Confirm that the path in the &lt;Import&gt; declaration is correct, and that the file exists on disk.

Now I am no where near an expert on MSBuild or the delicacies of .csproj files, so I did my best to poke around in there and see what might be going on. For those unaware, every .csproj file is actually just an XML file with various details about your actual project. In order to view/edit the project definition you can simply right-click on the project and select “Unload Project.” Once it has been unloaded, you can right-click again and select “Edit YourProject.csproj”

![](/images/subtext-content/FixingWebApplicationProjectswithautomate_B396/image_thumb_3.png)
  ![](/images/subtext-content/FixingWebApplicationProjectswithautomate_B396/image_thumb_4.png)


Once open, a search for the &lt;Import&gt; tag revealed the exact line causing the problem.

```csharp
<Import Project="$(MSBuildExtensionsPath)\Microsoft\VisualStudio\v9.0\WebApplications\Microsoft.WebApplication.targets" />
```

It would appear the Visual Studio 2008 will install all necessary MSBuild targets into the v9.0 directory – which is exactly what brings us to our problem. My Build Server does not have Visual Studio installed, it is just a basic Server 2008 box with .NET 3.5 and nothing fancy (aside from all the TFS gear). The problem is that these v9.0 targets were not available on my build machine, so I found 2 completely different solutions that ended up resolving my issue.

 

### Solution 1 – Add Conditional Imports (Not Recommended)

A google search of the actual MSBuild error brought me to a single post by [Steven Harman](http://stevenharman.net/blog/archive/0001/01/01/multi-targeting-vs2005-and-vs2008-web-application-projects-a-gotcha.aspx) which seemed helpful but I was skeptical because it was related to multi-targeting and problems with a machine running both VS 2008 and VS 2005. I decided to try it out by editing my csproj to the following:

I replaced the original &lt;Import&gt; declaration to the following

```csharp
<ImportCondition="'$(Solutions.VSVersion)' == '8.0'" Project="$(MSBuildExtensionsPath)\Microsoft\VisualStudio\v8.0\WebApplications\Microsoft.WebApplication.targets" />

<ImportCondition="'$(Solutions.VSVersion)' == '9.0'" Project="$(MSBuildExtensionsPath)\Microsoft\VisualStudio\v9.0\WebApplications\Microsoft.WebApplication.targets" />
```

With this change in place, I re-ran by TFS Build and it worked successfully. Unfortunately, this is extremely tedious to manually edit all of my .csproj files to facilitate automated builds.

 

### Solution 2 – Copy the v9.0 Targets to Build Machine (Recommended)

Once I started really thinking about the error, another solution seemed very clear and simple – just provide my build server with the target files. This solution ends up being much simpler and does not require editing any csproj files:

On your development machine, copy everything in “C:\\Program Files\\MSBuild\\Microsoft\\VisualStudio\\v9.0”  to the same folder on your build machine. This will provide your build machine with the correct target files required by your projects. I have only tested the Web Application projects but I see no reason that everything else would not work properly. Please let me know if anyone runs into issues with this.

![](/images/subtext-content/FixingWebApplicationProjectswithautomate_B396/image_thumb_5.png)


