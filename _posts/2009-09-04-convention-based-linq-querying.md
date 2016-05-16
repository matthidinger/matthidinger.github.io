---
title: "Convention based LINQ querying"
disqus_identifier: http://www.matthidinger.com/archive/2009/09/04/convention-based-linq-querying.aspx
redirect_from: /archive/2009/09/04/convention-based-linq-querying.aspx/
tags: 
- linq
- linq-to-sql
- expression-trees
header:
  teaser: 
---
LINQ and Expression Trees have enabled a ton of possibilities for us as developers, particularly in establishing some code-reducing convention based querying. I have found myself playing with Expressions in C\# since their inception and will hopefully be publishing a few other posts I have queued up. For now, this post will simply demonstrate how to take advantage of a popular convention whereby each database table always has a single integer primary key named “Id”

By taking advantage of this primary key convention I can save myself a ton of boilerplate code to query a table by ID.

### The Extension Method

```csharp
public static T GetById<T>(this IQueryable<T> query, int id) where T : class
{
    // Create lambda parameter x of type T
    var param = Expression.Parameter(typeof(T), "x");

    // Given x param, extract the Id property
    var memberExpression = Expression.Property(param, "Id");

    // Build Lambda expression
    // x => x.Id == id
    var whereClause =
        Expression.Lambda<Func<T, bool>>(
            Expression.Equal(
                memberExpression,
                Expression.Constant(id)
                ), param);

    return query.Single(whereClause);
}
```

### Usage

```csharp
NorthwindDataContext db = new NorthwindDataContext();
var product = db.Products.GetById(1);
var order = db.Orders.GetById(15);
```



