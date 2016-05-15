---
title: "Automatically roll back your LINQ to SQL integration tests"
disqus_identifier: http://www.matthidinger.com/archive/2009/09/08/automatically-roll-back-your-linq-to-sql-integration-tests.aspx
redirect_from: /archive/2009/09/08/automatically-roll-back-your-linq-to-sql-integration-tests.aspx/
tags: 
- linq-to-sql
- unit-testing
---
Today I began integration testing my SqlRepository while I experiment with an MVC prototype. I tried googling for a simple base class for integration testing a LINQ to SQL DataContext that would provide automatic rollback between each test, but after (minimal) searching, decided to simply write my own. Perhaps this will help someone. This base class was written for MS Test, but simply renaming the attributes accordingly would yield the same results on nUnit, xUnit, etc.

### The Code

Simply inherit your test class from this base class and any changes done via the internal Context property will be automatically rolled back after each test runs.

```csharp
/// <summary>
/// The base class will allow LINQ to SQL integration testing with automatic rollbacks after each test
/// </summary>
/// <typeparam name="TContext">The type of data context to use</typeparam>
public abstract class RolledBackDataContextTests<TContext> where TContext : DataContext
{
    private TContext _context;
    private DbTransaction _transaction;

    [TestInitialize]
    public void InitDataContext()
    {
        if(string.IsNullOrEmpty(ConnectionString))
        {
            _context = (TContext)Activator.CreateInstance(typeof(TContext));
        }
        else
        {
            _context = (TContext) Activator.CreateInstance(typeof (TContext), ConnectionString);
        }

        _context.Connection.Open();
        _transaction = _context.Connection.BeginTransaction();
        _context.Transaction = _transaction;
    }

    /// <summary>
    /// Provides access to the internal data context. Any changes made will be automatically rolled back
    /// </summary>
    protected TContext Context
    {
        get
        {
            if(_context == null)
                InitDataContext();

            return _context;
        }
    }

    /// <summary>
    /// Optionally specify the connection string to use
    /// </summary>
    protected virtual string ConnectionString
    {
        get
        {
            return null;
        }
    }

    [TestCleanup]
    public void TestCleanup()
    {
        _transaction.Rollback();
        _context.Dispose();
        _context = null;
    }
}
```

### Usage

```csharp
[TestClass]
public class SqlRepositoryTests : RolledBackDataContextTests<NorthwindDataContext>
{
    // Insert as many Products as required and then exercise your database integration Test Methods
    public void InsertProductToContext()
    {
        Product p = new Product { ProductName = "Temporary Product"};
        Context.Products.InsertOnSubmit(p);
        Context.SubmitChanges();

        // After each test ends, the transaction will be rolled back, and the new Product will not be in the database
    }

    [TestMethod]
    public void Test1()
    {
        // Test logic here
    }
}
```

