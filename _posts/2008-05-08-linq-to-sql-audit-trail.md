---
title: "LINQ to SQL Audit Trail"
disqus_identifier: http://www.matthidinger.com/archive/2008/05/08/linq-to-sql-audit-trail.aspx
redirect_from: /archive/2008/05/08/linq-to-sql-audit-trail.aspx/
tags: 
- linq-to-sql
- doddle
---
This post is out of date
------------------------

This post is outdated and has significantly enhanced with a new version. Please see [LINQ Audit Trail V2](http://www.matthidinger.com/archive/2009/01/12/linq-audit-trail-v2.aspx)

In a project I am currently working on, we had a fairly common requirement of recording an Audit Trail of any data changes. The requirements were typical, provide a running log of any changes in the database, including:

-   What table was modified?
-   What fields changed?
-   Who made the change?
-   When did it occur?

Naturally, there are many ways to tackle this problem. In the past I have either relied on writing database Triggers for the tables, or wrote the Auditing logic right into the stored procedure that was doing the modification. But this time, since the project is utilizing LINQ to SQL, I had a more ambitious idea in mind.

### The Goal

Create a flexible, and automated Auditing solution that would allow my team to add Audit tracking to any table in our database, with only a single line of C\# code.

The code I ended up with did in fact meet my goal -- which would add Auditing to the Products table and Categories table -- can be seen below.
As long as you call the Audit&lt;&gt; method before calling SubmitChanges() then any INSERTED/UPDATED/DELETED entities will be properly Audited automatically.
The first parameter in the method, is telling the Auditing code how to identity which property is the Primary Key of the table.

```csharp
public partial class NorthwindDataContext
{
    public override void SubmitChanges(ConflictMode failureMode)
    {
        this.Audit<Product>(p => p.ProductID, "Product modified ");
        this.Audit<Category>(c => c.CategoryID, "Category modified"); 
        base.SubmitChanges(failureMode);
    }
}
```

> **TIP: If you are interested in learning how this code was created, then please feel free to read the rest of this article. If however, you are only interested in the finished product and using the code in your projects, then head down to the bottom :)**

### Step 1 - Database Tables

Given my requirements I derived the following database schema. For my purposes, these tables did the trick, but of course your requirements may differ slightly so you may tweak as you wish.

-   The **Audits** table is used to track any change. Most of the columns should be self-explanatory. The Action is what CUD event occurred (Insert, Update, or Delete). The rest of the columns record who made the change, when, what table, and the Primary Key of the modified record.
-   The **AuditValues** table is used to track each modified column in the table being audited: the Old (Original), and the New (Current) value.

![](/images/subtext-content/LINQtoSQLAuditTrail_7DCD/image_thumb.png)


### Step 2 - The DBML

Now that we have our new tables, we will update our LINQ to SQL Entity classes. I am going to be using Northwind for this example.

 ![](/images/subtext-content/LINQtoSQLAuditTrail_7DCD/image_thumb_3.png)


### Step 3 - The Public Audit Extension Method

First we need to create a public method that client code will use to begin Auditing a table.

```csharp
/// <summary>
/// This method will enlist a LINQ to SQL Entity for automatic Auditing
/// </summary>
/// <typeparam name="TEntity">The Entity class you want to audit changes on</typeparam>
/// <param name="tableKeySelector">A Lambda expression that will return the Primary Key of the Entity</param>
/// <param name="title">The text that will be logged in the audit table</param>
public static void Audit<TEntity>(this DataContext db, Func<TEntity, int> tableKeySelector, string title) where TEntity : class
```

This is our public entry point for Auditing a table. This method might look a little bit intimidating to those unfamiliar with generic classes and generic delegates. Let's dissect this method to make it a little more palatable.

-   The first thing you should be aware of, is that this is an Extenstion method to the DataContext class. This is clear when you notice the "this" keyword in the first parameter. That means that this method will be available on any DataContext in our project (assuming of course, that you import the namespace the extension class resides in).
-   The second thing that might look strange is the Func&lt;T1, T2&gt; generic parameter. This is actually a Generic Delegate that exists in the System.Core assembly that ships with 3.5.  The 5 Func&lt;T1, T2, T3, T4, TResult&gt; overloads are used to designate a method that operates on 1 or more inputs (T1 through T4) and returns a TResult. Func's can be seen all over the LINQ namespace and you will get probably pretty familiar with them once you being extending and using LINQ. Typically, they will define the signature for a Lambda expression (which is a new C\# shorthand for defining an expression or anonymous method call). In this particular Func&lt;&gt; parameter, I am expecting a method (a Lambda expression, typically), that accepts a TEntity for input, and returns an int. This is required because we need to know how to find the Primary Key property of an Entity.
-   The third unique syntax in this method is the "where" keyword. This is telling the generic method that any TEntity that is passed to this method will be a reference type. This is required because LINQ to SQL can only map reference types.

 

### Step 4 - Auditing LINQ to SQL Entity Inheritance

I ran into something unexpected when I began testing the auditing code I wrote: Auditing my Entities that used inheritance. In case you didn't know, LINQ to SQL supports a type of relational inheritance known as Table-Per-Class Hierarchy. This means that every custom field for the derived entity classes are stored in the same table in the database. This article will not go into this subject any further, but please see [Guy Burnstein's Inheritance Article](http://blogs.microsoft.co.il/blogs/bursteg/archive/2007/10/01/linq-to-sql-inheritance.aspx "http://blogs.microsoft.co.il/blogs/bursteg/archive/2007/10/01/linq-to-sql-inheritance.aspx") on the subject of LINQ to SQL inheritance. The following images are courtesy of him, and only for demonstration's sake -- these entities will not be in my sample code.

<img src="http://blogs.microsoft.co.il/blogs/bursteg/WindowsLiveWriter/LinqtoSQLInheritance_7597/Person_0f4a4940-612f-4ad6-9969-9d7eb8cdea18.jpg" alt="Linq to SQL Inheritance" width="357" height="457" /><img src="http://blogs.microsoft.co.il/blogs/bursteg/WindowsLiveWriter/LinqtoSQLInheritance_7597/TablePerClassHierarchy_bb6bd854-6f96-44bb-9737-52680ec4f532.jpg" alt="Linq to SQL Inheritance" width="297" height="315" />

Naturally, I assumed that I could use the following code to Audit entities that supported inheritance just like regular Entities:

```csharp
this.Audit<SalesPerson>(sp => sp.PersonID, "SalesPerson changed");
this.Audit<Contact>(c => c.PersonID, "Contact changed");
```

Unfortunately for me, I was wrong. The Auditing code that I wrote relies on dataContext.GetTable&lt;TEntity&gt; to obtain a reference to the table being audited -- however, when I tried doing dataContext.GetTable&lt;SalesPerson&gt; I received an unpleasant exception stating that a derived entity cannot be used with the GetTable method -- instead, the exception actually suggested that I try dataContext.GetTable&lt;Person&gt;(), which did indeed work.

So due to this unexpected exception, I had to add an overload to the Audit method that supported two types, a TBaseEntity, and a TSubEntity.

```csharp
this.Audit<Contact, SalesPerson>(sp => sp.PersonID, "SalesPerson changed");
```

The method signature for this method is listed below. You will notice an additional Generic Constraint added, defining that TSubEntity must in fact derive from TBaseEntity.

```csharp
/// <summary>
/// This method will enlist a LINQ to SQL Entity for automatic Auditing
/// </summary>
/// <typeparam name="TBaseEntity">The Base Entity class you want to audit changes on</typeparam>
/// <typeparam name="TSubEntity">The Derived Entity class, for use in LINQ to SQL inheritance</typeparam>
/// <param name="tableKeySelector">A Lambda expression that will return the Primary Key of the Entity</param>
/// <param name="title">The text that will be logged in the audit table</param>
public static void Audit<TBaseEntity, TSubEntity>(this DataContext db, Func<TSubEntity, int> tableKeySelector, string title)
       where TBaseEntity : class
       where TSubEntity : TBaseEntity
```

### Step 5 - Auditing Inserted Records

The heart and soul of my auditing code relies on the DataContext's Object Tracking Service. You see, the LINQ to SQL DataContext is of course responsible for tracking entity changes. This is a necessary service so that it is able to queue up every insert, update, and delete -- patiently waiting for a call to dataContext.SubmitChanges(), at which point the context runs through every necessary SQL command to INSERT, UPDATE, and DELETE records in the database.

Thankfully, the DataContext exposes a GetChangeSet() method, which will allow us to peek into its pending database calls.

![](/images/subtext-content/LINQtoSQLAuditTrail_7DCD/image_thumb_4.png)


```csharp
private static void AuditInserts<TEntity, TSubEntity>(DataContext db, Func<TSubEntity, int> tableKeySelector, string title)
    where TEntity : class
    where TSubEntity : TEntity
{
    var inserts = db.GetChangeSet().Inserts.OfType<TSubEntity>();
```

Here we can see a perfect example of LINQ to Objects. The GetChangeSet().Inserts property return a List&lt;Object&gt;, but that doesn't do us much good, because we are only interested in the Entities we want to audit. Therefore, we can use the new OfType&lt;&gt; extension method to only pull back the entities we are concerned with.

Next, we need to obtain a reference to the Table&lt;&gt; that our Entity belongs to.

```csharp
Table<TEntity> table = db.GetTable<TEntity>();
```

Then we need to get all the public properties that our Entity has.

```csharp
PropertyInfo[] props = typeof(TSubEntity).GetProperties(BindingFlags.Instance | BindingFlags.Public | BindingFlags.FlattenHierarchy);
```

I have also created a quick helper-method that will create the row in the Audit table for us

```csharp
private static Audit CreateAudit<TEntity>(string title, Table<TEntity> table, int key) where TEntity : class
{
    Audit audit = new Audit();
    audit.TableName = table.ToString();
    audit.TableKey = key;
    audit.UserName = CurrentUser;
    audit.AuditDate = DateTime.Now;
    return audit;
}
```

The rest of the code is simply looping through all of the Entities in the ChangeSet.

```csharp
foreach (TSubEntity item in inserts)
{
    // Get the Primary Key for our table by Invoking the tableKeySelector delegate on the current TSubEntity item
    int key = tableKeySelector.Invoke(item);

    // Create the Audit
    Audit audit = CreateAudit<TEntity>(title, table, key);
    audit.Title = title + " added";
    audit.Action = "Insert";

    // Loop through every property in our inserted entity
    foreach (PropertyInfo pi in props)
    {
        // This code checks to see if the property is a LINQ to SQL column. You may change this if you need.
        if (pi.HasAttribute(typeof(ColumnAttribute)))
        {
            // I chose to ignore any Id columns in the auditing, again, you may change this
            if (pi.Name.EndsWith("Id"))
                continue;

            // Creat the AuditValue row and add it to our current Audit
            AuditValue values = new AuditValue();
            values.MemberName = pi.Name;
            values.NewValue = GetPropertyValue(pi, item);

            audit.AuditValues.Add(values);
        }
    }

    // Insert the Audit to the database
    db.InsertAudit(audit);
}
```

### Step 6 - Audit Deletes

Very few things change from the Insert code here.

```csharp
var deletes = db.GetChangeSet().Deletes.OfType<TSubEntity>();
```

I also set the OldValue property instead of the NewValue property when creating the AuditValues entity.

```csharp
AuditValue values = new AuditValue();
values.MemberName = pi.Name;
values.OldValue = GetPropertyValue(pi, item);
```

### Step 7 - Audit Updates

Auditing updates is greatly simplified again thanks to our hard-working DataContext. Every Table&lt;T&gt; class has a GetModifiedMembers method that can be invoked on any entity. This method will only return properties which were CHANGED. This is exactly what I need because I did not want to record any values that stayed the same, especially for tables with a large number of columns.

```csharp
ModifiedMemberInfo[] mmi = table.GetModifiedMembers(item);
foreach (TSubEntity item in updates)
{
    int key = tableKey.Invoke(item);

    Audit audit = CreateAudit<TEntity>(title, table, key);
    audit.Title = title + " updated";
    audit.Action = "Update";

    ModifiedMemberInfo[] mmi = table.GetModifiedMembers(item);

    foreach (ModifiedMemberInfo mi in mmi)
    {
        AuditValue values = new AuditValue();
        values.MemberName = mi.Member.Name;

        values.OldValue = GetPropertyValue(mi.OriginalValue);
        values.NewValue = GetPropertyValue(mi.CurrentValue);

        audit.AuditValues.Add(values);
    }

    db.InsertAudit(audit);
}
```

### The Finished Results

I wrote a very quick demo app for this article. You can see below a GridView of the Audits table rows. We can see what we changed, when, by whom, etc. If you select one of the Audits, a DetailsView will display all of the Changed Values that took place during the Audit.

![](/images/subtext-content/LINQtoSQLAuditTrail_7DCD/image_thumb_5.png)


![](/images/subtext-content/LINQtoSQLAuditTrail_7DCD/image_thumb_6.png)


![](/images/subtext-content/LINQtoSQLAuditTrail_7DCD/image_thumb_7.png)
 

### Get the Code!

If you stuck around for that whole article then I am impressed! If however, you just want to view, experiment with, and use the code, then I provide it here for your use. I have also included the sample Northwind Project so you can play with the demo yourself.

To download the latest version of this project please see the CodePlex Project: [DoddleAudit](http://www.codeplex.com/DoddleAudit)

Thanks for reading, and please let me know if you end up using this code or have any cool features or optimizations that you have added or would like to see added!


