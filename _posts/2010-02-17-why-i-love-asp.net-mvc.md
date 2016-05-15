---
title: "Why I love ASP.NET MVC"
disqus_identifier: http://www.matthidinger.com/archive/2010/02/17/why-i-love-asp.net-mvc.aspx
redirect_from: /archive/2010/02/17/why-i-love-asp.net-mvc.aspx/
tags: 
- aspnet
- aspnet-mvc
- rant
---
![](/images/subtext-content/WhyIloveASP.NETMVC_C88B/430489129_88c2d4a072_thumb.jpg)

On the surface, I suppose this is YAMVCVWFC (Yet Another MVC vs. WebForms Comparison). If this topic doesn’t appeal to you, or you’re sick and tired of this discussion then I encourage you to move on. I won’t be offended, promise. This post is here to serve as my living, breathing arguments for fighting for MVC and it will serve to highlight my major gripes with Web Forms.

The motivation for this post came from an all-too-familiar IRC chat in \#asp.net – for those of you unfamiliar with IRC, it’s a lot like the Twitter of the 90s.

### Fallacy: Web Forms does everything I need it to

(01:29p) &lt;webformsdev&gt; 99.9999999999% of client requests, project requirements, etc etc, can easily and equally be done using webforms or mvc
(01:30p) &lt;webformsdev&gt; webforms + jquery = does everything I need
(01:30p) &lt;@mattman&gt; getting something done, and getting something done in a testable, maintainable, long-term way, are entirely different

### Fallacy: MVC is just a bunch of &lt;%= HtmlHelpers %&gt;

(01:33p) &lt;webformsdev&gt; how is &lt;%HtmlHelper%&gt; innovative
(01:34p) &lt;@mattman&gt; HtmlHelpers are 4% of the ASP.NET MVC platform. That’s like saying &lt;asp:Textbox&gt; is all of asp.net webforms
(01:35p) &lt;@mattman&gt; <http://www.codethinked.com/post/2010/01/22/Controls-Do-Not-Make-You-More-Productive.aspx> 

### Fallacy: Web Forms is easier

(01:41p) &lt;webformsdev&gt; but i believe if you know how to use webforms, properly, you don't encounter that bullshit
(01:41p) &lt;@mattman&gt; no one knows how to use webforms properly
(01:42p) &lt;@mattman&gt; developers every day struggle with dynamic controls and databinding in even slightly-complex real-world scenarios. Mindlessly tweaking code and refreshing the page to see what ASP.NET will render.
(01:42p) &lt;@mattman&gt; Commenting and uncommenting out blocks of if(!Page.IsPostBack) logic, moving chunks of manipulation code from PreInit, to Init, to Load, to PreRender. All Trial and error, ad infinitum.
(01:42p) &lt;@mattman&gt; I've personally wasted more time on that than I ever care to admit

### Fact: Web Forms is Black Magic

(01:43p) &lt;@mattman&gt; Here’s the thing, I hate black magic, I hate not knowing what's going on in my framework, especially when you get UpdatePanels involved, etc. Its an abstraction I just don't need. It doesn't make me faster, more productive, help other developers understand or maintain my code later, or help me understand how things are really working in case I need to dive in and debug. You just tweak it ‘til it works and then go home
(01:43p) &lt;@mattman&gt; MVC has none of that. It’s just HTTP, GETs and POSTs, with a pluggable model binding mechanism, pluggable validation, some scaffolding options if you want them, etc.

### Fact: MVC enables robust AJAX support

(01:44p) &lt;@mattman&gt; With MVC the HTML is free to craft as you wish. This alone allows much, much better javascript/DOM interaction, needless to say with frameworks like jQuery. Without having to worry about posting \_\_VIEWSTATE back or deal with the page lifecycle, TRUE partial page updates are a reality in a much more intuitive way. Not to mention entirely more efficient on both the client and the server when compared to UpdatePanels

### Fact: MVC is closer to the metal

(01:44p) &lt;webformsdev&gt; mattman, then you must really like PHP too, minus the lack of IDE/framework
(01:45p) &lt;@mattman&gt; I have done plenty of PHP work. Which is why I was able to adapt to MVC quicker than most with a WebForms background. 50% of ASP.NET Web Forms developers have no idea what an HTTP POST is.
(01:45p) &lt;@mattman&gt; I liked the web side of PHP very much. I liked knowing at a glance WHY something was being rendered a certain way, even if it wasn’t entirely maintainable and a big mix of logic. I liked for loops to build my grids, with condition logic plainly visible to tweak a row based on some “data binding” logic

### Fact: DataBinding is confusing, full of indirection and runtime logic

(01:46p) &lt;@mattman&gt; INSTEAD OF Repeaters with OnItemDataBound and runtime casting an e.Item.DataItem object, getting properties on that object state, and then using e.Item.FindControl to manipulate the data binding template --  with EVEN MORE most casting and runtime failures
(01:46p) &lt;@mattman&gt; ItemDataBound and the likes are completely counter-intuitive and cause developers to really hunt around looking for rendering logic in the template itself, the code-behind, etc

### Fact: MVC lends itself to good design

(01:47p) &lt;@mattman&gt; Web Forms has is so tightly coupled at every layer it makes true separation of concerns almost impossible. The Page is instantiated by the runtime, making ground-up use of an IOC container inflexible, and a burden to say the least. WCSF from P&P helps with this, but having used it on a large project it was not nearly as useful as MVC has been.
(01:47p) &lt;@mattman&gt;The MVC designers recognized this and created the ControllerFactory class for us, so using IOC and a container can be seamlessly used from the start of the request pipeline. MVC is entirely extensible and pluggable at every stage.

### Fact: Web Forms is miserable without JavaScript

(01:50p) &lt;@mattman&gt; How many ASP.NET developers test their pages without javascript? Take that a step further, how many of them are even aware that their precious &lt;asp:LinkButton&gt; won’t even work with JavaScript disabled? Will my GridView still sort without javascript? HINT: It won’t!
(01:50p) &lt;@mattman&gt; While this technically isn’t the fault of Web Forms at its core, it does happily guide developers down a path without even remotely presenting the repercussions of those decisions. Not many people fully appreciate that their simple use of an &lt;asp:LinkButton&gt; has now prevented all visitors without javascript from using the site correctly. Those same users can’t even go to the second page of a GridView.
(01:51p) &lt;@mattman&gt; MVC makes javascript use explicit. And in fact encourages the use of graceful degradation or progressive enhancement techniques. These ideas are becoming increasingly commonplace for modern web sites for a host of reasons.

### Fact: MVC is testable

This wasn’t discussed in the conversation, but I will throw it in. MVC is testable, simple as that. Not many care about testing – in fact far fewer than I wish unfortunately. But it is becoming increasingly important in professional development shops. There have been tons of debates that I wish I had the logs for on this topic, ranging from people swearing that Web Forms is testable if you are careful, etc. But the fact of the matter is, people are not careful. We’ve all seen the reality of modern ASP.NET development, people don’t like to think about where their code goes – just put it in the simplest place that could work (code-behind), load the page, and call it a day. Regression bugs run rampant in many ASP.NET projects because it is so tightly coupled that changing a single user control by removing some if(!Page.IsPostBack) logic causes a huge cascade of failures in pages you never even heard of. MVC intuitively gives the Views so little power that it is actually more of chore to put some untestable logic into this “quick fix” than it is to do it the right way.

### Fact: MVC allows multiple &lt;form&gt; tags

I will never forget the look on a friend’s face when I told him that ASP.NET *forced* developers to use one &lt;form&gt; per page. This friend was a classic ASP developer and has since moved on to other things, but the sheer notion of this limitation literally made his jaw drop. This is such a ridiculous constraint on Page developers that I can recall first moving to ASP.NET from PHP and having such a hard time getting my head around such an outrageous constraint. MVC takes developers back to the way the web was meant to be utilized. This single change offers so many benefits I am disappointed with myself that I left it so far down the list.

### Summary

That about wraps up the 20-minute conversation. I will probably be amending this post in the future should any new areas for discussion come about. Comments are welcome!

 

