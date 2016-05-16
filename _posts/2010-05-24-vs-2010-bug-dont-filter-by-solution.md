---
title: "VS 2010 bug - Don&rsquo;t Filter Pending Changes by Solution"
disqus_identifier: http://www.matthidinger.com/archive/2010/05/24/vs-2010-bug-dont-filter-by-solution.aspx
redirect_from: /archive/2010/05/24/vs-2010-bug-dont-filter-by-solution.aspx/
tags: 
header:
  teaser: subtext-content/VS2010bugDontFilterPendingChangesbySolut_A26A/bugfeature_thumb.jpg
---
![](/images/subtext-content/VS2010bugDontFilterPendingChangesbySolut_A26A/bugfeature_thumb.jpg)

Long story short, I have been struggling with a very frustrating Visual Studio 2010 bug since last Monday. All of a sudden, VS was hanging and eventually crashing every time I loaded my solution. After a while, I finally noticed something in the Server Explorer window… If you look closely at the screenshot below, you will notice that every node in my database says “\[Expanding…\]” after it – but it’s actually worse than that. In fact, every single database connection (I had 8 in my server explorer), is trying to open itself, and expand every single table, column, stored procedure, and view inside of each database… This was issuing thousands and thousands of SQL queries to all my database connections to query their schema, and of course, causing VS2010 to hang itself.

![](/images/subtext-content/VS2010bugDontFilterPendingChangesbySolut_A26A/1_thumb.png)
 

After some research, I found that this bug is only triggered when my solution is bound to source control (TFS 2010). Today, an MS developer who appears to own the code in question, was able to repro my issue and found a workaround for now. \[emphasis mine\]

> Matt,
>
> I think I have a repro of this problem. If you have “Filter by solution” option turned on in the pending changes tool window, we are trying to walk the hierarchy of all projects, **and database node registers itself as a project**. The workaround is to turn “Filter by solution” off.

Below you can see the toolbar button “Filter by Solution” which I have highlighted in red – **Don’t click this button, at least until a hotfix or SP1 is released.** :)

![](/images/subtext-content/VS2010bugDontFilterPendingChangesbySolut_A26A/image_thumb_3.png)


