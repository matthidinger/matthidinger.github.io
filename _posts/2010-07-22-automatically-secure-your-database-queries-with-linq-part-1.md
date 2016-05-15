---
title: "Automatically secure your database queries with LINQ &ndash; Part 1"
disqus_identifier: http://www.matthidinger.com/archive/2010/07/22/automatically-secure-your-database-queries-with-linq-part-1.aspx
redirect_from: /archive/2010/07/22/automatically-secure-your-database-queries-with-linq-part-1.aspx/
tags: 
- security
- architecture
- linq
- linq-to-sql
- entity-framework
header:
  teaser: subtext-content/8eb6584b2301_132D8/security_thumb.jpg
---
![](/images/subtext-content/8eb6584b2301_132D8/security_thumb.jpg)

A common requirement for many applications is filtering rows of data based on the current user. A simple example is an e-commerce site which would want to make sure a Customer who is logged in is only able to view his own Orders. Another example would be a payroll site that would want to make sure a user could only view their own Employees.

These are of course trivial examples, and could be solved in a number of ways. My concern is that often times the responsibility of security is placed upon each individual developer to make sure they are calling the right methods on your repositories. This may seem fine to many readers, and we could debate whether or not this should be the case, but my current take on security is to let the application infrastructure handle those details for you.

What if I could easily make it so anytime a developer needed to use an IOrderRepository to retrieve orders, no matter which methods he called on this repository, were automatically filtered based on the user’s security context? That would make my application security a lot more resilient over the long-term and into maintenance, if a developer didn’t have to worry about remembering to call repository.GetOrdersForUser(\_userSession.UserId) instead of accidently calling repsitory.GetAll().

Below I have written a simple QueryFilterService that will basically store “where” clauses for each type entity that you want to secure. Part 2 of this series will cover where the Security Context will come from and how to bring it all together.

### Usage

If you want to play around with this class, the usage is described below – however, this “manual” method is not recommended, the next part of the series will describe how to incorporate this into your repository classes automatically:

```csharp
// On your application init, you need to register your security rules
// Below I am securing Orders so that the logged in Customer can only see his own Orders
// You will notice the syntax looks a lot like a LINQ Where statement -- which is exactly what it is.
// It is basically saying, anytime you query the Orders table, inject the following WHERE clause so that only the current Customer's Orders are returned
// This will work even if you have other LINQ statements already in your query, including other where statements
_filterService.SecureEntity<Order>(o => o.CustomerId == _userSession.CustomerId);


// Later on, during application execution, get the filtered result-set of any entity...
// The filteredOrders variable below will only contain Orders where the order.CustomerId == the logged-in CustomerId
var db = new DataContext();
var allOrders = db.Orders;
var filteredOrders = _filterService.SecureQuery(allOrders);
```

Essentially, the process is boiled down to this:

1.  When your application starts up, register all the “security clauses” you need in your application. There are basically WHERE statements that will be automatically injected into the LINQ expression tree every time a developer queries the database
2.  During application execution, your repository classes will understand the QueryFilterService and make sure that if there is a “security clause” applied to this type of entity, it will automatically append it to the current query, thereby automatically filtering the result set according to your security rules.

 

### Implementation

```csharp
public class QueryFilterService
{
    private readonly Dictionary<Type, LambdaExpression> _filters;

    public QueryFilterService()
    {
        _filters = new Dictionary<Type, LambdaExpression>();
    }

    public void SecureEntity<TEntity>(Expression<Func<TEntity, bool>> filter)
    {
        _filters.Add(typeof(TEntity), filter);
    }

    public TEntity AuthorizeEntity<TEntity>(TEntity entity)
    {
        if (!IsEntitySecured<TEntity>())
            return entity;

        var whereClause = GetSecurityExpression<TEntity>();
        bool authorized = whereClause.Compile().Invoke(entity);

        if (authorized == false)
        {
            throw new SecurityException(string.Format("Unathorized access to the requested entity: {0}.", typeof(TEntity)));
        }

        return entity;
    }

    public IQueryable<TEntity> SecureQuery<TEntity>(IQueryable<TEntity> query)
    {
        if (!IsEntitySecured<TEntity>())
            return query;

        var whereClause = GetSecurityExpression<TEntity>();
        return query.Where(whereClause);
    }

    public bool IsEntitySecured<TEntity>()
    {
        Type entityType = typeof(TEntity);
        return _filters.ContainsKey(entityType);
    }

    protected Expression<Func<TEntity, bool>> GetSecurityExpression<TEntity>()
    {
        Type entityType = typeof(TEntity);
        var expression = _filters[entityType];

        return Expression.Lambda<Func<TEntity, bool>>(expression.Body, expression.Parameters);
    }
}
```

### Stay Tuned for Part 2

If this isn’t making sense, stay tuned for part 2 where I will try to bring it all together!

 

 

