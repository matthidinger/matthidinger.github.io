---
title: "Sharing Code: Windows 8 and Windows Phone"
disqus_identifier: http://www.matthidinger.com/archive/2012/12/05/sharing-code-windows-8-and-windows-phone.aspx
redirect_from: /archive/2012/12/05/sharing-code-windows-8-and-windows-phone.aspx/
tags: 
- presentations
- wpdev
- winrt
- xaml
- pcl
- architecture
---
I recently had the opportunity to speak at Microsoft’s [New Era of Work](http://www.microsoft.com/enterprise/events/theneweraofwork3/#fbid=7bLqKFFM2kc) conference in Chicago. Below you’ll find the presentation material, the Real-World Stocks project which demonstrates the principles, and a high-level recap of the lessons learned while practicing the following techniques in actual apps.

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Sharing-Code-Windows-8-and-Windows-Phone_83EC/image_thumb_3.png)
 ![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Sharing-Code-Windows-8-and-Windows-Phone_83EC/screenshot_12052012_110659_thumb.png)

-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Slides
------

A number of slides were provided by Microsoft, and many specifically from [Matthias Shapiro](http://twitter.com/matthiasshap). Be sure to check out [his blog](http://matthiasshapiro.com/) for more excellent Windows Phone articles!

|                                                                                                                                                                                                                                                                                                                                                                                      |     |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----|
| ![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Sharing-Code-Windows-8-and-Windows-Phone_83EC/WP_20121128_001_thumb.jpg)
  |     |

 

source
------

<table>
<colgroup>
<col width="50%" />
<col width="50%" />
</colgroup>
<tbody>
<tr class="odd">
<td><a href="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Sharing-Code-Windows-8-and-Windows-Phone_83EC/image_6.png"><img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Sharing-Code-Windows-8-and-Windows-Phone_83EC/image_thumb_2.png" title="image" alt="image" width="202" height="354" /></a></td>
<td><p>For this talk I started with my <a href="http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-1-Introduction-and-Outline.aspx">Real-World Stocks Windows Phone</a> project, extracted the central logic into a Portable Class Library, and used File-Linking to share Controls and Converters between the two projects.</p>
<p>The full source code for Real-World Stocks can be downloaded at the following link, inside a new folder named <strong>CodeSharingSample</strong>.</p>
<a href="http://realworldstocks.codeplex.com/" title="http://realworldstocks.codeplex.com/"><br />
http://realworldstocks.codeplex.com/</a><br />
<br />

<p><br />
For my mercurial fans…</p>
<br />
hg clone https://hg.codeplex.com/realworldstocks</td>
</tr>
</tbody>
</table>

Recap: the six techniques of sharing
------------------------------------

Sharing code is getting easier, but like all things, there is no silver bullet. Below are six techniques I’ve used in every app I’ve shared code between -- you will very likely use a combination of all of them in a single solution.

####  

#### Ctrl-C, Ctrl-V

The tried and true technique for sharing code. Simple, elegant, and a potential maintenance nightmare.

Copy/pasting files is still very useful for sharing some XAML across platforms. It will let you copy the XAML as a starting point, and tweak it to look best on the alternate platform. The obvious trade-off being that these files are no way associated, so any tweaks to the XAML in the future will need to be made in both places.

####  

#### Linked Files

Sometimes you need to share a raw .cs file between projects. You can copy/paste the file or use *Add Existing Item,* but this will create a duplicate file on disk, so any changes made in the future will need to be copy/pasted again. **

*Linking* source files between projects will come in very handy when you want to share a custom Control, or maybe a handful of custom Converters. Since Linked Files are still the same file on disk, any change made in one will be persisted between all projects.

**Pro tip:** Finally in VS 2012, you can hold the Left-Alt key and drag entire folders between projects… It will Add a Link for every file inside the folder!

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Sharing-Code-Windows-8-and-Windows-Phone_83EC/image_thumb_1.png)


####  

#### Linked Files enhanced with \#if blocks

Sometimes your Linked Files won’t immediately compile on both platforms.

A very common nuisance is when accessibility modifier are different. For example, sharing a custom Control I wrote for Real-World Stocks: in Silverlight the method signature for *OnApplyTemplate* **** is *public;* in Windows it’s marked *protected*. To work around this I had to write a rather silly \#if block to tweak how this code will be compiled, depending on which platform it’s compiling on.

```csharp
namespace RealWorldStocks.UI.Phone.Controls
{
    [TemplateVisualState(Name = "Positive", GroupName = "PriceStates")]
    [TemplateVisualState(Name = "Negative", GroupName = "PriceStates")]
    public class PriceChangeArrow : Control
    {
        public PriceChangeArrow()
        {
            DefaultStyleKey = typeof (PriceChangeArrow);
        }

#if NETFX_CORE
        protected override void OnApplyTemplate()
#else
        public override void OnApplyTemplate()
#endif
        {
            LayoutUpdated += PriceChangeArrow_LayoutUpdated;
            base.OnApplyTemplate();
        }
    }
}
```

####  

#### Portable Class Libraries (PCLs)

When you want to move away from sharing raw source assets you will want to check out PCLs.

When you Add –&gt; New Project and select a Portable Class Library, you will see the following dialog, allowing you to specify exactly which platforms you’d like to target. IntelliSense and the tooling will only surface APIs which are common across all chosen platforms.

Your end result is a single project, with a single codebase, *outputting a single assembly* (.dll) that is able to be referenced by any of the targeted platforms.

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Sharing-Code-Windows-8-and-Windows-Phone_83EC/image_thumb_5.png)


 

#### A Platform Adapter Abstraction

PCLs are excellent tools, but not all .NET APIs are currently available to them.

Suppose you want to write a shared HTTP stack in your PCL, which will certainly need the ability to do GZip decompression. Unfortunately you realize the PCL has no GZipStream type. To solve this, I create an abstract class named *PlatformAdapter*, which has a static property to access the *Current* instance. Each platform is then responsible for implementing a concrete platform adapter to provide the implementation **and** initialize the Current property on startup.

*Download the full sample project to see how these pieces fit together.*

```csharp
namespace RealWorldStocks.Core
{
    public abstract class PlatformAdapter
    {
        /// <summary>
        /// Provides acess to the current platform adapter
        /// </summary>
        public static PlatformAdapter Current { get; set; }


        public abstract string ReadCompressedResponseStream(HttpWebResponse response);
        public abstract void BeginInvoke(Action actionToInvoke);
        public abstract ISettingsStore Settings { get; }
    }
}
```

#### 
Your skills – it’s not always about sharing raw assets

Lastly, and arguably the biggest thing worth sharing: your skills.

You know C\#. You know .NET. You know (and love) XAML. These skills will you get a huge head-start, specifically on the XAML stacks. They aren’t 100% identical, as seen above, but the overarching concepts are exactly the same.

### 

Finally, above all else…
========================

Make a great user experience!
-----------------------------

Sharing code, assets, and skills are all great tools for more efficient software delivery. Just don’t forget that you are creating software for different platforms, and the user should always have the optimal experience on each. Not every screen is going to show the same data, in the same way.

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Sharing-Code-Windows-8-and-Windows-Phone_83EC/image_thumb_6.png)


 

