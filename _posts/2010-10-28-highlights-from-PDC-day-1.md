---
title: "highlights from PDC day 1"
disqus_identifier: http://www.matthidinger.com/archive/2010/10/28/highlights-from-PDC-day-1.aspx
redirect_from: /archive/2010/10/28/highlights-from-PDC-day-1.aspx/
tags: 
- pdc
- c-sharp
- azure
- wpdev
header:
  teaser: subtext-content/www_matthidinger_com/Windows-Live-Writer/d9e167c9f174_135B1/Microsoft-PDC-2010_thumb.jpg
---
### ![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/d9e167c9f174_135B1/Microsoft-PDC-2010_thumb.jpg)
Portable Library Projects

At MIX 10 Microsoft announced a rather modest code-sharing technique to allow Silverlight and .NET apps to share a small subset of System.\* libraries. Well today at PDC Shawn Burke had a 60-minute session called “3-screen coding – Sharing code between Windows Phone, Silverlight, and .NET.” He unveiled a new Class Library project type called a “Portable Library” which can be directly referenced by any type of project. The obvious goal here is to share your core business logic between your various client-side applications. Thankfully Visual Studio will even trim IntelliSense within a Portable Library project to only APIs which have been specifically defined as portable between all application types.

Release date for Portable Library projects is H1 2011

[PDC Video: 3-Screen Coding](http://bit.ly/aUlqkU)

 

### Async Programming Improvements

Probably the most popular announcement today was “The Future of C\# and VB” talk, which highlighted the improvements to Asynchronous Programming in our next compiler versions. New compiler keywords have been added called “await” and “async” which will instruct the compiler to generate a state machine around our asynchronous code (much the same way iterators and the yield keyword were introduced in C\# 2).

[PDC Video – The Future of C\# and Visual Basic](http://bit.ly/bBGOfV)

[Soma talks about making Asynchronous Programming Easy](http://blogs.msdn.com/b/somasegar/archive/2010/10/28/making-asynchronous-programming-easy.aspx "http://blogs.msdn.com/b/somasegar/archive/2010/10/28/making-asynchronous-programming-easy.aspx")

[Eric Lippert is starting a series on the enhancements](http://blogs.msdn.com/b/ericlippert/archive/2010/10/28/asynchrony-in-c-5-part-one.aspx)

 

### Windows Phone Profiler

The new Windows Phone Profiler was probably my favorite announcement. As of this writing [Bus Watch](http://www.matthidinger.com/archive/2010/10/12/bus-watch-chicago-submitted-to-wp7-marketplace.aspx) is finally on the marketplace, not to suggest that the road wasn’t bumpy. I basically re-wrote the entire thing after finally receiving a prototype device to test my app on – the differences between the emulator and device were staggering. A ton of the apps currently in the early marketplace are suffering major performance problems. I think this is of course due to the growing pains of a new platform, but mostly due to the fact that most developers didn’t have access to an early device. Hopefully with the help of the new Profiler that Scott Gu demo’d at the keynote will make the next 6 months of Marketplace apps just as impressive as the native applications. It has an impressive and thorough UI – and will be completely free. I very much look forward to using this tool in my future applications.

[Covered in the keynote](http://bit.ly/akeK7Q)

 

### Azure Improvements

I don’t use Azure right now, but I think I’ll be looking into it more soon. The coolest feature that I saw demo'd was RDP access to the virtual machine. You also get a full IIS Manager, as well as a number of other improvements that I probably can’t full appreciate until I use them or was forced to suffer through the hardships that the early adopters had to deal with without them.

[Covered in the keynote](http://bit.ly/akeK7Q)

 

