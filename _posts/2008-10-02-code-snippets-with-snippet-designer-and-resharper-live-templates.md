---
title: "Code Snippets with Snippet Designer and ReSharper Live Templates"
disqus_identifier: https://www.matthidinger.com/archive/2008/10/02/code-snippets-with-snippet-designer-and-resharper-live-templates.aspx
redirect_from: /archive/2008/10/02/code-snippets-with-snippet-designer-and-resharper-live-templates.aspx/
tags: 
- visual-studio
- resharper
header:
  teaser: subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb.png
---
### Just what exactly are these snippets?

I believe that snippets are an underused feature built into Visual Studio. This post is my attempt at comparing the two tools I have used for snippet creation, and hoping to make more developers out there aware of just how easy they are to create and use in your existing projects. I am by no means an expert with either of these tools, but I think that is the point: *they take a few minutes to create and can be reused for immediate time savers.*

Much to my surprise there exists a significant number of .NET developers that are not taking advantage of code snippets, built-in or otherwise. No doubt you have all seen them in intellisense before: they appear with a partially-jagged piece of paper as seen below. When selected, they expand into a template of code that has select editable variables. A number of predefined code-snippets ship with Visual Studio, many of which I use regularly, including ctor, prop, exception, try, etc.

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb.png)


The “prop” snippet “expands” into the following code:

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb_3.png)


So the big question is how can we create our own snippets? Let’s take a real-world example and find out.

### Snipper Designer (free Visual Studio Plugin)

A few weeks ago a project was released on CodePlex called Snipper Designer. [Snippet Designer](https://www.codeplex.com/SnippetDesigner) **** is a plugin for Visual Studio that was previously used internally by Microsoft and has since been released for all of us to enjoy. After downloading the MSI, it istalled in no time and I was on my way to creating a basic snippet I wish I had created long ago.

To start off I took some Configuration Property code that I had already written as the starting point for my snippet. Anyone who has done extensive configuration with the System.Configuration assembly should be very familiar with this code: it is a property declaration for automatic strongly-typed reading and writing to an XML attribute in your app.config. There are a number of similar code snippets I will be creating for various Configuration-related tasks, and I hope to update this post with my complete list of Configuration snippets shortly.

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb_4.png)


As you can see, the Snipper Designer has added a context menu item to export highlighted code as a snippet. In doing so, the code below was produced in my Snippet Designer:

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb_5.png)


From here all I had to do was decide which “variables” would be available in my snippet. This is identifiable by the twin dollar signs ($) at the beginning and end of the variable. Finally, I assigned the snippet a shortcut, which is how we will invoke the snippet expansion in a code file. The shortcut I chose was “configProp.”

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb_6.png)


Our final bit of customization lies in a property pane below the snippet code. From here I can define tooltips to help other developers who may be using my snippets, as well as set default values and expected data types associated with a variable. As you can see, I specified that the isRequired variable should be a Boolean that defaults to true.

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb_7.png)


### 
ReSharper Live Templates

Many of you will probably be familiar with the Visual Studio plugin [ReSharper](https://www.jetbrains.com/resharper). ReSharper has quickly become a favorite of mine over the last year or so, and I feel as though I have only scratched the surface of it’s productivity potential. One of said features is their own snippet framework (which they have named Live Templates). ReSharper Live Templates are slightly more powerful than the aforementioned Snippet Designer.

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb_8.png)


As you can clearly see, the ReSharper snippet code is almost identical to Snippet Designer. This is a great thing. In fact, I copy-pasted my Snippet Designer code into ReSharper and it instantly recognized it, so the two are very interoperable in that regard.

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb_9.png)


The variable definition pane is where ReSharper really shines. It has significantly more customization over Snippet Designer, given it’s very nice macro support. I have certainly not experimented with all of these predefined macro’s but they seem like they would be great features for advanced and more intelligent snippet scenarios. I hope to play with them a bit more in the near future. Above you will notice that I have used the “Constant value” macro to specify defaults for the isRequired and DataType variable, which are “true” and “string”, respectively..

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb_10.png)


So what exactly did the last few minutes do for us? Well for me, any time in the future where I need to define a new Configuration Property in code, I will no longer by force into vastly error-prone copy-pasting. Instead, I simply trigger my snippet by it’s predefined shortcut. In my case, I chose “configProp.”

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb_11.png)


When selected, it expands into this simple code block, which allows me to \[tab\] through the 5 variables and be on my way. And if you happen to think this won’t save you much time, then I would challenge the fact that you have probably not copy-pasted a significant number of these configuration properties before. As I mentioned in the beginning, I will be creating an army of these snippets, ranging from not only my Configuration-related ones, but repeatable tasks like ViewState-backed property wrappers, etc.

![](/images/subtext-content/CodeSnippetswithSnippetDesignerandReShar_AE89/image_thumb_12.png)
 

### Download

-   [Snippet Designer](https://www.codeplex.com/SnippetDesigner)
-   [ReSharper](https://www.jetbrains.com/resharper)


