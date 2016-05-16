---
title: "Writing a Fluent ASP.NET MVC Recursive TreeView Helper"
disqus_identifier: http://www.matthidinger.com/archive/2011/11/27/Writing-a-Fluent-ASP-NET-MVC-Recursive-TreeView-Helper.aspx
redirect_from: /archive/2011/11/27/Writing-a-Fluent-ASP-NET-MVC-Recursive-TreeView-Helper.aspx/
tags: 
- aspnet-mvc
- fluent
- razor
- nuget
header:
  teaser: subtext-content/www_matthidinger_com/Windows-Live-Writer/d59c757b9eff_CC0C/image_thumb_3.png
---
This post is an update to my original [ASP.NET MVC Recursive TreeView Helper](http://www.matthidinger.com/archive/2009/02/08/asp.net-mvc-recursive-treeview-helper.aspx "http://www.matthidinger.com/archive/2009/02/08/asp.net-mvc-recursive-treeview-helper.aspx") from almost 3 years ago. Oddly enough it’s still a high-traffic post and has close to 50 comments asking for an update or a complete solution to download. I figured if I was going to do that, I might as well give the API a much-needed facelift and pop it on NuGet.

What is it?
-----------

#### Given the following self-referencing hierarchal model…

```csharp
public class TreeViewLocation
{
    public TreeViewLocation()
    {
        ChildLocations = new HashSet<TreeViewLocation>();
    }

    public int Id { get; set; }
    public string Name { get; set; }

    public virtual int? ParentLocationId { get; set; }
        
    public virtual ICollection<TreeViewLocation> ChildLocations { get; set; }
}
```

#### …we want to generate an HTML unordered-list like this

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/d59c757b9eff_CC0C/image_thumb_3.png)


what’s the new API look like?
-----------------------------

First, apologies for mixing syntax highlighters. My default one doesn’t have a great Razor theme yet.

The following Razor shows the API we will create. It follows a fluent syntax which many developers greatly prefer over the alternative (dozens of overloads!) In the end, it’s easier for us to write, easier to extend in the future, and more discoverable for developers who use it later on. This particular TreeView implementation also takes advantage of Razor’s awesome HelperResult templating delegate (the @&lt;text&gt; syntax seen below).

``` code
@model List<MvcTreeView.Models.Location>

@(Html.TreeView(Model)
    .EmptyContent("No locations have been defined yet!")    
    .Children(m => m.ChildLocations)
    .HtmlAttributes(new { id = "tree"})
    .ChildrenHtmlAttributes(new { @class = "subItem"})
    .ItemText(m => m.Name)
    .ItemTemplate(
        @<text>
            <a href="#@item.Id">@item.Name</a>
        </text>)
)
```

How was it written?
-------------------

### Defining a Fluent API

Writing a fluent API is typically pretty simple. The key requirement is that each method returns the type of the class, and always terminates with “return this;” The rest of the method body usually just stores some state to a private field, which will eventually be used to render the customized UI.

For example, to set the ItemText which will display the item label in each &lt;li&gt;, we take the property selector and simply store it into the \_displayProperty field, eventually returning the current instance allowing for further methods to be chained together.

```csharp
public TreeView<T> ItemText(Func<T, string> selector)
{
    if (selector == null) throw new ArgumentNullException("selector");
    _displayProperty = selector;
    return this;
}
```

### Rendering / IHtmlString

Finally, once the developer has customized exactly how the TreeView should be rendered, we need to output the HTML.

One way to hook into this infrastructure is by implementing both **IHtmlString** and overriding **ToString()**. MVC will inspect whether we implement **IHtmlString** and if so, will call **ToHtmlString()** to trigger our rendering which is written to view.

Also notice the **ValidateSettings()** call – this is necessary in many fluent configurations, since these kinds of APIs lend themselves to invalid configuration on occasion. For example using 2 incompatible methods like ItemText() and ItemTemplate() together – typically you either want to use a simple text display or a full-blowing template display – but it’s impossible to use both. We could throw an exception here alerting the developer that this is an invalid configuration.

```csharp
public override string ToString()
{
    ValidateSettings();

    var listItems = _items.ToList();

    var ul = new TagBuilder("ul");
    ul.MergeAttributes(_htmlAttributes);

    // snip...
    return ul.ToString();
}

public string ToHtmlString()
{
    return ToString();
}
```

Get The Code
------------

This helper is very easy to add to your project using NuGet. Alternatively you can still go the manual route and grab the code from CodePlex.

### NuGet / NuGet Sample Package

With this project I decided to include a [NuGet Sample Package](http://blog.davidebbo.com/2011/03/take-nuget-to-next-level-with-sample.html) which is used to easily demonstrate the usage of the helper.

**These are source-only packages.** By installing this package into your project you will get a raw file in **Helpers\\TreeView.cs** that you can edit or update as you see fit.

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/d59c757b9eff_CC0C/image_thumb_4.png)


The sample project is the same concept, it will add a **TreeViewController**, and a **TreeView.cshtml** view which demonstrates the usage of the TreeView helper. Once you’ve tried out the sample and played with it, it’s very easy to uninstall via NuGet to remove the unnecessary files.

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/d59c757b9eff_CC0C/image_thumb.png)


### CodePlex

And of course, the full source is available to download on CodePlex.

#### <http://mvctreeview.codeplex.com>

#### [Browse the latest source code](http://mvctreeview.codeplex.com/SourceControl/BrowseLatest)

 

