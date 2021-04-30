---
title: "Entity Framework Comparison Frustration: Explained"
disqus_identifier: https://www.matthidinger.com/archive/2008/02/26/entity-framework-comparison-frustration-explained.aspx
redirect_from: /archive/2008/02/26/entity-framework-comparison-frustration-explained.aspx/
tags: 
- entity-framework
- linq
header:
  teaser: 
---
This post is a follow-up to an article I wrote a few weeks ago, [ADO.NET Entity Framework Comparison Frustration](https://blog.matthidinger.com/2008/02/01/ADONETEntityFrameworkComparisonFrustration.aspx). As a quick re-cap, I was simply trying to filter a list of users with a LINQ query expression by comparing custom classes, not primitive types.

```csharp
TorvusEntities entities = new TorvusEntities(); 

// Pull my Account Entity from the database
Account matt = entities.Accounts.First(a => a.AccountId == 10);

// Attempt to get all Teams by a Team Owner
var teams = from t in entities.Teams
                 where t.Owner == matt
                 select t;
```

However, an exception was thrown.

> Unable to create a constant value of type 'Closure type'. Only primitive types (for instance Int32, String and Guid) are supported in this context.

So I left it at that. The Entity Framework could only handle comparison on primitive types, which makes sense of course, since the expression needs to be converted into the underlying data storage language (T-SQL in this case). I was simply hoping that they would provide a more object-oriented way of translating the comparison I hoped to express by some other means. E.g., overriding Object.Equals() or the == operator, implementing a certain interface on my entities, something that felt OO to me.

Today however, I found my answer. Embarrassingly enough, it was [in the MSDN docs all along](https://msdn2.microsoft.com/en-us/library/bb738686.aspx).

> A comparison expression checks whether a constant value, property value, or method result is equal, not equal, greater than, or less than another value. If a particular comparison is not valid for LINQ to Entities, an exception will be thrown. \[Specifically, the exception I wrote above.\] All comparisons, both implicit and explicit, require that all components are comparable in the data store. Comparison expressions are often used in **Where** clauses for restricting the query results.

And here it is, the confirmation I wanted (albeit not the answer I was hoping for):

> LINQ to Entities does not support using a user class as a constant. However, a property reference on a user class is considered a constant, and will be converted to a command tree constant expression and executed on the data store.

Oh, another thing worth mentioning, method returns don't count as so-called constant expressions, and will thrown an exception when attempted.

```csharp
public class MyBusinessObject
{
    public int GetId()
    {
        return 5;
    }
}

public class Test
{
    public Test()
    {
        using (TorvusEntities context = new TorvusEntities())
        {
            MyBusinessObject myBo = new MyBusinessObject();
            var accounts = from a in context.Accounts
                           where a.AccountId == myBo.GetId()
                           select a;

            // Exception will be thrown at run-time,
            // methods do not count as Constant expressions
        }
    }
}
```

