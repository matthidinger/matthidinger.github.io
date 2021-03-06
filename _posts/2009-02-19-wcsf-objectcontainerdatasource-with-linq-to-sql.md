---
title: "WCSF ObjectContainerDataSource with LINQ to SQL"
disqus_identifier: https://www.matthidinger.com/archive/2009/02/19/wcsf-objectcontainerdatasource-with-linq-to-sql.aspx
redirect_from: /archive/2009/02/19/wcsf-objectcontainerdatasource-with-linq-to-sql.aspx/
tags: 
- wcsf
- linq-to-sql
header:
  teaser: 
---
A project I am now working on is using the [Web Client Software Factory](https://www.codeplex.com/websf) (WCSF) from the [patterns & practices](https://msdn.microsoft.com/practices) team. It is basically an elaborate MVP-based framework that currently sits on top of ASP.NET Webforms.

One of the components it ships with is the **ObjectContainerDataSource** which is a lot like the ObjectDataSource that ASP.NET provides. I admittedly have little experience with either of these controls, since I am not a huge fan of declarative data binding in larger applications. It does however offer better integration with the MVP pattern, simplifying the “bubbling” of DataSource events up to the Presenter to handle them. The Presenter is of course where all of the logic for the view and its services belongs.

At first everything was working great: selects, server-side paging, server-side sorting, even inserting. But when I tried some Updates and Deletes with the GridView and the ObjectContainerDataSource I was encountering a frustrating exception I hadn’t seen before.

> *Row not found or changed.*

The exception was being thrown on the dataContext.SubmitChanges(). After some quick digging I found that this error is due to our Timestamp column which is used by the LinqDataContext for optimistic concurrency. Before the Data Source fires its Updated event, it re-creates an instance of the object and populates the properties with the values in the data control using reflection. However, the ObjectContainterDataSource was not setting the Timestamp property when it was re-constructing the object for updating. This was causing the LinqDataContext to throw the “Row not Found” exception because it could not find a row WHERE ContractorId = 1 AND Timestamp = NULL. I needed some way to persist the Timestamp property within the DataSource so it would re-populate it on the Updated event.

```csharp
exec sp_executesql N'UPDATE [dbo].[Contractors] 
SET [ContractorName] = @p2 WHERE ([ContractorId] = @p0) AND ([Timestamp] = @p1) 

@p0=1,
@p1=NULL,
@p2='My Updated Contractor'
```

The solution I found, was to include the Timestamp column in the DataKeyNames property. This ensured that the data source would correctly populate the property even though it did not appear as a column in my GridView.

```csharp
<asp:GridView ID="ContractorGrid" runat="server" 
    AutoGenerateEditButton="true" AutoGenerateDeleteButton="true"
    DataSourceID="ContractorDataSource" DataKeyNames="ContractorId, Timestamp"
    PageSize="5" AllowPaging="true" AllowSorting="true" AutoGenerateColumns="false">
```

This may be a well-known problem with LINQ to SQL and the DataSources, but as I mentioned I don’t use them that much for declarative data binding. Either way, hopefully this saves someone frustration down the road.


