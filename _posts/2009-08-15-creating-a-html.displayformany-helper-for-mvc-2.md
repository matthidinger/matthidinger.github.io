---
title: "Creating a Html.DisplayForMany Helper for MVC 2"
disqus_identifier: http://www.matthidinger.com/archive/2009/08/15/creating-a-html.displayformany-helper-for-mvc-2.aspx
redirect_from: /archive/2009/08/15/creating-a-html.displayformany-helper-for-mvc-2.aspx/
tags: 
- aspnet-mvc
header:
  teaser: http://www.matthidinger.com/contentimages/CreatingaHtm.DisplayForManyHelperforMVC2_1164D/image_thumb.png
---
**Note: This article was written for ASP.NET MVC 2 Preview 1 – it may become outdated in future previews.**

The Html helper in ASP.NET MVC 2 comes with some handy methods called “DisplayFor” and “EditFor” – please see [Scott Gu’s](http://weblogs.asp.net/scottgu/archive/2009/07/31/asp-net-mvc-v2-preview-1-released.aspx) article if you are not familiar with these new features. Long story short, they provide an ASP.NET Dynamic Data-like mechanism which uses reflection and templating to render a display form or an edit form. It works great for primitive properties like String, DataTime, Int32, as well as complex types like “Address.” However, as I was playing with them, I came across a rather funny exception (excusable, I suppose, due to the preview state of MVC 2 at the time of this writing).

 

> #### *This exception should never occur.*
>
> **Description:** An unhandled exception occurred during the execution of the current web request. Please review the stack trace for more information about the error and where it originated in the code.
> **Exception Details:** System.InvalidOperationException: This exception should never occur.
> **Source Error:**
>
>     Line 5:  <%= Html.DisplayFor(m => m.Comments) %>

This error occurs because the “Comments” property is an **IList&lt;Comment&gt;** – the DisplayFor() method choked because the property type is an interface rather than a concrete class that of course derives from System.Object – which is where the DisplayFor reflection magic comes from. However, that wasn’t really my problem, I could work around that and make my property a List&lt;Comment&gt; instead of IList&lt;Comment&gt; (as a workaround). After this change, the exception is gone, but the results are not what I needed.

> Capacity: 2
>
> Count: 2

This is what ended up being rendered on my page, which makes sense – DisplayFor() reflected on the 2 public properties of the List&lt;T&gt; type and displayed them for me. What I really wanted to do however, was iterate over the list and call DisplayFor() on each individual item.

### Enter the DisplayForMany extension method.

The code is longer than I would like due to a number of complications and restrictions in the current DisplayFor extension methods and internal classes that would have been handy to have access to. The comments hopefully explain the workarounds, but in any case, just copy this code into your helper class and enjoy.

```csharp
public static string DisplayForMany<TModel, TValue>(this HtmlHelper<TModel> html, Expression<Func<TModel, IEnumerable<TValue>>> expression) where TModel : class
{
    StringBuilder sb = new StringBuilder();

    // Get the items from ViewData
    var items = expression.Compile()(html.ViewData.Model);


    foreach(TValue item in items)
    {
        // Current html.DisplayFor() throws exception if the expression is anything that isn't a "MemberAccessExpression"
        // So we have to trick it and place the item into a dummy wrapper and access the item through a Property
        var dummy = new {Item = item};

        // Get the actual item by accessing the "Item" property from our dummy class
        var memberExpression = Expression.MakeMemberAccess(Expression.Constant(dummy), dummy.GetType().GetProperty("Item"));

        // Create a lambda expression passing the MemberExpression to access the "Item" property and the expression params
        var singleItemExpression = Expression.Lambda<Func<TModel, TValue>>(memberExpression,
                                                                           expression.Parameters);

        string singleItemHtml = html.DisplayFor(singleItemExpression);
        sb.AppendFormat(singleItemHtml);    
    }

    return sb.ToString();
}
```

 

### Usage and Output

```csharp
<h3>Comments</h3>
<%= Html.DisplayForMany(m => m.Comments) %>
```

![](http://www.matthidinger.com/contentimages/CreatingaHtm.DisplayForManyHelperforMVC2_1164D/image_thumb.png)


 

