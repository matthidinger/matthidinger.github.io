---
title: "On making your API flexible to consumers"
disqus_identifier: http://www.matthidinger.com/archive/2010/08/18/on-making-your-api-flexible-to-consumers.aspx
redirect_from: /archive/2010/08/18/on-making-your-api-flexible-to-consumers.aspx/
tags: 
- c-sharp
- linq
header:
  teaser: 
---
A year ago I had written briefly about [my love-affair with the yield keyword](http://matthidinger.com/archive/2009/09/22/yet-another-yield-rant.aspx). Today a question was posed to me and the follow-up discussion was interesting enough to me to warrant a quick post.

> If you're returning an IEnumberable&lt;T&gt; from a method that reads from a DataReader, is it bad to use yield? My concern is calling a long-running method while looping over the items returned from the method – won’t this keep the SQL connection open longer? Also what if an exception happens while looping, will my reader still get closed?

His proposed API was similar to the following very common (and outdated, IMHO) pattern – which is turning a DataReader into data access or business objects.

### The Proposed API

So what exactly is my issue with this API? Well let’s assume that the caller does indeed want all the items returned from the DataReader, as seem in the TestDataAccess method. But what if we want to use LINQ to trim this list?

 

 

Now our consumer code is going to break out of the loop early… in fact very early, after only taking a single item. While this isn’t really a concern in our sample method since it is only adding 2 items to the list, it is certainly feasible that our DataReader could return thousands or millions of rows in the future. This means that our consumer of this method is only interested in a subset of the data… but we are always returning a fully-populated List&lt;string&gt; that contains every row from our database.

### Taking advantage of iterators

Let’s tweak this to use IEnumerable.

 

 

Now our GetItems() method is taking advantage of a feature that has existed since .NET 2.0 – iterators. While not only making the code more succinct and readable, it has a major performance advantage. By returning an IEnumerable we are giving our consumer full freedom to use our API in ways that **they see fit**. If they only want 1 item, or a smaller subset, they can break out of the loop early and our DataReader will close when finished.

So that’s all well and good, but doesn’t really address his concern in the first place…

> What if the foreach loop is executing a long operation? Won’t that keep the DataReader open for much longer?

In this case, my friend’s concerns are real. If he intends to do complex long-running operations on each returned object inside the loop, then it will absolutely keep the SQL connection open longer than it should be. With that in mind, the fix is extremely simple – Because we’ve kept our API flexible!

With a simple .ToList() call we can get our items from the DataReader in the quickest way possible, and let the reader close the connection. Once we have the list of items in memory, we are free to do our lengthy operations at will.

### Summary

While this particular post was focused on iterators, yield, and deferred execution, I think it’s very important for us to try to make our API’s as flexible as possible. We cannot possibly predict every way in which our code will be used by consumers, even if that consumer is your future self!

 

