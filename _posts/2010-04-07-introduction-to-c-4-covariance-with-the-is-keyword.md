---
title: "Introduction to C# 4 Covariance with the is keyword"
disqus_identifier: https://www.matthidinger.com/archive/2010/04/07/introduction-to-c-4-covariance-with-the-is-keyword.aspx
redirect_from: /archive/2010/04/07/introduction-to-c-4-covariance-with-the-is-keyword.aspx/
tags: 
- vs2010
- .net-4
header:
  teaser: subtext-content/ExploringC4Covariancewiththeisandaskeywo_FE57/cloningresultsmayvary_thumb.jpg
---
![](/images/subtext-content/ExploringC4Covariancewiththeisandaskeywo_FE57/cloningresultsmayvary_thumb.jpg)

Starting back in 2007 I read [a series on Co/contra-variance in C\# by](https://blogs.msdn.com/ericlippert/archive/2007/10/16/covariance-and-contravariance-in-c-part-one.aspx) Eric Lippert – Eric is on the compiler team at MS and one of my favorite bloggers to read I might add. At the time, I remember myself reading along with the words but my eyes completely glazing over. To be honest the concept mostly eluded me at the time, so I wanted to take this opportunity to describe the feature in a way that made the most sense to me.

### It Seems to Logical…

Ask yourself the following questions:

1.  Is a List&lt;string&gt; also a List&lt;object&gt;?
2.  Is an IEnumerable&lt;string&gt; also an IEnumerable&lt;object&gt;?

As you’ll see below, the answers to these questions depends entirely on the version of the C\# compiler you are using.

### Turning our Questions into Tests

Naturally, the best way to answer the questions above is to turn them into a test. Let’s run them in 2008 and 2010 and check the results.

#### Visual Studio 2008 (.NET 3.5)

![](/images/subtext-content/ExploringC4Covariancewiththeisandaskeywo_FE57/image_thumb.png)


 

#### Visual Studio 2010 (.NET 4)

![](/images/subtext-content/ExploringC4Covariancewiththeisandaskeywo_FE57/image_thumb_3.png)


### What have we discovered

#### VS 2008

In VS 2008 both tests failed. It turns out that T is T and not anything that is a superclass or subclass of T. The implications of this are that if you have a method that accepted an IEnumerable&lt;Person&gt;, but you have a List&lt;SalesPerson&gt;, you would think that you could surely pass your list into the method… unfortunately you would be incorrect.

#### VS 2010

In VS 2010 however, one of our tests actually passed. It turns out that in C\# 3 a List&lt;string&gt; is in fact an IEnumerable&lt;object&gt;. So our simple scenario above would in fact allow us to pass a List&lt;SalesPerson&gt; to a method that accepts an IEnumerable&lt;Person&gt;.

The short explanation of this change is due to the fact that the IEnumerable&lt;T&gt; interface was actually changed in .NET 4 to be IEnumerable&lt;out T&gt; – a whole new reason to use the out keyword. **This means that any method within this interface that uses the T parameter CAN ONLY RETURN T and never accept it into any method arguments.** Other .NET 4 interfaces, such as IComparer&lt;in T&gt; are similar but opposite: any methods in this interface can only use T as a method input parameter but never the return type.

#### But why isn’t a List&lt;string&gt; also a List&lt;object&gt; even in .NET 4?

Ah so you noticed that one of our tests still failed even in VS 2010… Well if you read the recap above this will start to make sense. **The List&lt;T&gt; class contains methods that use the T parameter as both inputs and outputs – it can insert T into the list and also retrieve an instance of T.**

It would have to be declared as List&lt;in out T&gt; – which is not possible for two reasons:

1.  List&lt;T&gt; is a class, and **generic variance support only applies to interface and delegate types.**
2.  IList&lt;in out T&gt; is a syntax error. It would mean the same thing as it always has: IList&lt;T&gt; already means that it can be used as inputs and outputs.

Hopefully this quick introduction to generic variance was helpful. I am by no means an expert on this subject, so I encourage you to read Eric Lippert’s series above if this is something you find interesting!

 

