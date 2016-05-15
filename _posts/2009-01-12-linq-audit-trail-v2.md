---
title: "LINQ Audit Trail v2 - DoddleAudit"
disqus_identifier: http://www.matthidinger.com/archive/2009/01/12/linq-audit-trail-v2.aspx
redirect_from: /archive/2009/01/12/linq-audit-trail-v2.aspx/
tags: 
- linq
- linq-to-sql
- doddle
---
[A couple months ago](http://www.matthidinger.com/archive/2008/05/08/linq-to-sql-audit-trail.aspx) I wrote a basic set of extension methods to handle automatic auditing in LINQ to SQL. Well I have received a large number of emails regarding this particular project so I have decided to focus on cleaning up my v2 API and releasing it on CodePlex. There was a lot of room for improvement from version 1 and today I am going to post the all new LINQ Audit Trail code. This new version is significantly enhanced in the previous version.

### Objective

> Automatic auditing of all inserts/updates/deletes for any table in your database with a single line of code, including:
>
> -   What table was modified?
> -   What fields changed?
> -   Who made the change?
> -   When did it occur?

### 
Usage

Simply define your audit definitions at any time before calling SubmitChanges();

```csharp
this.Products.Audit();
this.Categories.Audit();
this.Orders.Audit().AuditAssociation(o => o.Order_Details);
this.Contacts.Audit().AuditAssociation(c => c.Addresses).AuditAssociation(c => c.PhoneNumbers);
```

### Updates and Download

Please see the CodePlex project for updates and new releases. **[DoddleAudit](http://www.codeplex.com/DoddleAudit)**

### New Features and Fixes in V2

-   A significantly refined API for defining which tables to audit, including automatic primary key lookups.
-   Inserted records will have their primary keys correctly stored in the audit table now.
-   Built-in support for auditing across relationships.
    -   E.g., assume you want to audit a Contacts table which has a 1-to-many relationship to the Addresses table, thus allowing any number of Addresses to each Contact. Well ideally you want to show these Address audits on your ContactDetails.aspx, which is exactly what you can see in the screenshot below. 
        [<img src="/images/subtext-content/LINQAuditTrailv2_B491/image_thumb.png" title="image" alt="image" width="535" height="508" />](/images/subtext-content/LINQAuditTrailv2_B491/image.png)

Ability to define custom “audit property resolvers” to override the default auditing mechanism for properties that you specify.

-   For example, notice in the above screenshot that “Address Type” has a value of “1” since that is how the data is stored in the table. This number does little good for the end user, so in V2 it is now possible to customize specific properties as needed. I will explain more details about this soon. Below I am overriding the default auditing of the Product.CategoryID property by querying the category by looking up the CategoryID, returning the Category.CategoryName, and renaming the audit field to “Category” since “CategoryID” is no longer accurate.

```csharp
public class ProductAuditResolver : AuditPropertyResolver
{
    protected override void CustomizeProperties()
    {
        CustomizeProperty(p => p.CategoryID, categoryId => GetCategoryByID(cid).CategoryName, "Category");
    }
}   
   
```

### 

### Instructions

1.  [Download the latest release from CodePlex](http://www.codeplex.com/doddleaudit), the source code and compiled DLL are available, and add reference to **Doddle.Linq.Audit.dll** in your project that contains your LINQ to SQL DBML
2.  At a minimum you will need to add 2 tables to your database (and your DBML) to store the audit records. Please see the schema below and add these tables to your database.
    -   NOTE: Keep in mind this database schema is entirely customizable. I chose to use two tables to store all of my audits, but you could very easily change this logic to use a separate table for each entity or whatever storage schema you choose.  
        [<img src="/images/subtext-content/LINQAuditTrailv2_B491/image_thumb_3.png" title="image" alt="image" width="709" height="274" />](/images/subtext-content/LINQAuditTrailv2_B491/image_3.png)

3.  Open your DBML and click in the designer surface. In the property pane you will need to change the **Base Class** property of your generated DataContext to be **Doddle.Linq.Audit.LinqToSql.AuditableDataContext 
    [<img src="/images/subtext-content/LINQAuditTrailv2_B491/image_thumb_4.png" title="image" alt="image" width="618" height="243" />](/images/subtext-content/LINQAuditTrailv2_B491/image_4.png)
    **
4.  Lastly you will need to create a partial DataContext class to wire up the auditing infrastructure to match your database schema. Add a new Class file to your project and insert the following code. Customize if necessary to match your auditing schema.
    [](http://11011.net/software/vspaste)[](http://11011.net/software/vspaste)

    ```csharp
    public partial class NorthwindEntitiesDataContext
    {
        protected override void InsertAuditRecordToDatabase(EntityAuditRecord record)
        {
            AuditRecord audit = new AuditRecord();
            audit.Action = (byte)record.Action;
            audit.AuditDate = DateTime.Now;
            audit.AssociationTable = record.AssociationTable;
            audit.AssociationTableKey = record.AssociationTableKey;
            audit.EntityTable = record.EntityTable;
            audit.EntityTableKey = record.EntityTableKey;

            audit.UserName = HttpContext.Current.User.Identity.Name;

            foreach (ModifiedEntityProperty av in record.ModifiedProperties)
            {
                AuditRecordModifiedField field = new AuditRecordModifiedField();
                field.MemberName = av.MemberName;
                field.OldValue = av.OldValue;
                field.NewValue = av.NewValue;

                audit.AuditRecordModifiedFields.Add(field);
            }

            this.AuditRecords.InsertOnSubmit(audit);
        }

        protected override void DefaultAuditDefinitions()
        {
            this.Products.Audit();
            this.Categories.Audit().AuditAssociation(c => c.Products);
        }
    }
    ```

### Known Issues

1.  I have not finished the support for the Entity Framework implementation of the auditing yet. If anyone more experienced with EF is out there downloading this source please let me know if you want to help complete it.

Hopefully that is enough to get anyone started with the code. I am certainly looking for feedback for any suggestions, problems, or improvements. After some more unit testing and perhaps some slight refinements to the API I will remove the “beta” moniker.



