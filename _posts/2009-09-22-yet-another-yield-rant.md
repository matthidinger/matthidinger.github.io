---
title: "Yet Another Yield Rant"
disqus_identifier: http://www.matthidinger.com/archive/2009/09/22/yet-another-yield-rant.aspx
redirect_from: /archive/2009/09/22/yet-another-yield-rant.aspx/
tags: 
- c-sharp
---
This post was spawned as I was reviewing the latest [Oxite source code](http://oxite.codeplex.com/SourceControl/changeset/view/43567#709744) on [CodePlex](http://oxite.codeplex.com). I’ve been reading any source code I could get my hands on lately looking for inspiration to cure my “winter coding boredom.” While it isn’t winter yet, it is fast approaching, which means less outdoors time and more computer time. I try to blog more, update my open source projects with a new release, and with any luck begin a new project worth getting passionate about.

Today I'm going to hit the ground running with a short tip, again, on the yield keyword.

The following code is an excerpt from the Oxite Blog class. Blog as it turns out, is a Cacheable Entity (ICacheEntity) where the designer of the interface determined that cached entities can specify any dependencies they may have. Clearly, the developer of the ICacheEntity interface understood iterators and realized that the consumer of any ICacheEntity requires nothing more foreach’ing over the dependencies. For this reason, the method does not return an IList&lt;T&gt;, an ICollection&lt;T&gt;, or (heaven forbid) a List&lt;T&gt;.

Unfortunately, the developer writing the Blog class did not take advantage of the (albeit minor) utility provided. The developer chose to new up a List, insert the single item, then return the list -- as seen in the following code.

```csharp
IEnumerable<ICacheEntity> ICacheEntity.GetCacheDependencyItems()
{
    List<ICacheEntity> dependencies = new List<ICacheEntity>();

    dependencies.Add(Site);

    return dependencies;
}
```

We've all written code like this. The bad habit may even be so ingrained into our developer DNA that we don't even realize it. *Long story short, if it returns IEnumerable, you should probably use the yield keyword!*

The above code can simply be re-written as follows. The benefits of this should be clear: fewer lines of code, easier readability, greater performance (minor of course, but still).  Since this topic has been covered [at great length](http://lmgtfy.com/?q=c%23+yield) on the blogosphere I won't go into any more detail, but just in case, [here is a quick article](http://www.ytechie.com/2009/02/using-c-yield-for-readability-and-performance.html) I found that should help explain the benefits.

```csharp
IEnumerable<ICacheEntity> ICacheEntity.GetCacheDependencyItems()
{
     yield return Site;
}
```

 

### Bonus Protip

I actually stumbled onto something small but nice while reading the Oxite code. Enumerable.Empty.

```csharp
IEnumerable<Product> products = Enumerable.Empty<Product>;
```

 

