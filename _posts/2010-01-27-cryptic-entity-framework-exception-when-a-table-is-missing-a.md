---
title: "Cryptic Entity Framework exception when a table is missing a primary key"
disqus_identifier: https://www.matthidinger.com/archive/2010/01/27/cryptic-entity-framework-exception-when-a-table-is-missing-a.aspx
redirect_from: /archive/2010/01/27/cryptic-entity-framework-exception-when-a-table-is-missing-a.aspx/
tags: 
- entity-framework
- ef4
header:
  teaser: subtext-content/CrypticEntityFrameworkexceptionwhenatabl_DC8B/pphtable_thumb.png
---
> Unable to update the EntitySet 'PlanPriceHistory' because it has a DefiningQuery and no &lt;InsertFunction&gt; element exists in the &lt;ModificationFunctionMapping&gt; element to support the current operation.

While I was getting my feet wet in Entity Framework 4 (from the Visual Studio 2010 Beta 2 release), I generated my EDMX from an existing legacy database. All was going well – for a few days in fact, until I attempted to Insert an entity to a specific table (seen below). After some digging around in my model/EDMX configuration thinking something was wrong in there, I decided to open the actual table definition for the EntitySet (‘PlanPriceHistory’) that EF was complaining about. The problem with this particular table is that it logically uses a composite primary key *(but was mistakenly not defined as such in the database)*.

The fix was as simple as highlighting the columns and selecting the context menu “Set Primary Key”

![](/images/subtext-content/CrypticEntityFrameworkexceptionwhenatabl_DC8B/pphtable_thumb.png)
 ![](/images/subtext-content/CrypticEntityFrameworkexceptionwhenatabl_DC8B/pphtable2_thumb.png)


Finally, open your EDMX, select the Entity, and **Update Model from Database…**

![](/images/subtext-content/CrypticEntityFrameworkexceptionwhenatabl_DC8B/pphmodel_thumb.png)


All set, now back to business.

 

