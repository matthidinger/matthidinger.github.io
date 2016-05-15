---
title: "Simplifying application caching"
disqus_identifier: http://www.matthidinger.com/archive/2012/01/13/simplifying-application-caching.aspx
redirect_from: /archive/2012/01/13/simplifying-application-caching.aspx/
tags: 
- aspnet-mvc
- caching
---
![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/11fa22879ac6_B1E4/image_thumb%5B4%5D_thumb.png)

Many ASP.NET applications utilize the **System.Web.Caching.Cache** in some way. While it offers a pretty simple Dictionary-like API that your app can start using immediately, I typically create a combined “tell-don’t-ask” wrapper around it – which has some additional architectural benefits as well.

### Out of the box concerns

A very common usage of the Cache API can be seen below, but there are a few initial problems I have with it:

1.  Ugly, non-generic casting
2.  Manual null checks
3.  Duplicating the string for the key
4.  Lots of implementation details sprinkled around
5.  No out of box way to scope the cache. For example, cache a unique copy of the item for each User

 

```csharp
public ActionResult Bad()
{
    var firstVisit = HttpContext.Cache.Get("FirstVisit") as DateTime?;
    if(firstVisit == null)
    {
        firstVisit = DateTime.Now;
        HttpContext.Cache.Insert("FirstVisit", firstVisit, null, DateTime.Now.AddMinutes(1), TimeSpan.Zero);
    }

    return View("Index", firstVisit.Value);
}
```

 

### A simple ICache/HttpCache wrapper

The wrapper I create is used below. It’s nothing revolutionary, but does try to cut down on the redundancy, while adding a few features as well. The following code functions exactly the same as the code above.

```csharp
public ActionResult Index()
{
    var firstVisit = _cache.Get(CacheScope.User, "FirstVisit", TimeSpan.FromMinutes(1), () => DateTime.Now);
    return View(firstVisit);
}
```

The three biggest changes are:

1.  Implicit generic casting (the Get() method is automatically returning a nice, typed DateTime object because the Func&lt;T&gt; at the end became a Func&lt;DateTime&gt;)
2.  Tell-don’t-ask. Instead of asking the cache if it already contains something by checking for null, then creating and adding the new item into the cache, I’d rather just combine these 2 functions and have the cache figure out what it needs to do. The last method parameter is a Func&lt;T&gt; which will be invoked if the item is not already in the cache.
3.  Added a CacheScope which allows the developer to cache something application-wide, or for each user individually.

### Architectural advantages

Aside from these API usage changes we also get 2 big architectural advantages:

1.  The application can rely on a new ICache interface, which means you can access the cache from a lower, non-web layer without having to reference System.Web
2.  The provided implementation of ICache is an HttpCache, which by default uses HttpContext.Current, but provides a nice testability hook to plug in your own mocked HttpContextBase if you want to do some integration testing

### Going the extra mile

You may notice that our controller still has intimate knowledge of our caching strategy: duration, scope, the string-based key, etc. This code-duplication lightning-rod could easily be copy-pasted around. One possible way to solve this would be to create something like the following AppCache.

#### A central AppCache

```csharp
/// <summary>
/// This class demonstrates fully abstracting the details of your caching strategy and could serve as the single entry point for cached data
/// </summary>
public static class AppCache
{
    public static ICache InternalCache = new HttpCache();

    public static DateTime UsersFirstVisit = InternalCache.Get(CacheScope.User, "FirstVisit", TimeSpan.FromMinutes(1), () => DateTime.Now);
}
```

#### Usage in a Controller

```csharp
public ActionResult FullyAbstracted()
{
    var firstVisit = AppCache.UsersFirstVisit;
    return View("Index", firstVisit);
}
```

Now we are completely free to change the caching strategy of our application in a single place.

Get the Code
------------

Rather than pasting the full source here, I will be publishing it along with a sample project at [**http://mvcgrabbag.codeplex.com**](http://mvcgrabbag.codeplex.com)

#### [Browse the HttpCache code, MvcGrabBag.Web/Caching folder](http://mvcgrabbag.codeplex.com/SourceControl/changeset/view/2ea3da6732a6#MvcGrabBag.Web%2fCaching%2fHttpCache.cs)

 

