---
title: "Entity Framework T4 Template Enhancements &ndash; Part 1"
disqus_identifier: http://www.matthidinger.com/archive/2010/04/22/entity-framework-t4-template-enhancements-ndash-part-1.aspx
redirect_from: /archive/2010/04/22/entity-framework-t4-template-enhancements-ndash-part-1.aspx/
tags: 
- t4
- ef4
- entity-framework
---
> *This post is part of a series on customizing the Entity Framework T4 templates*
>
> I have been using EF4 for a little while now, and have been taking advantage of the code-generation extensibility afforded to us by T4 templates. This series of posts will describe the enhancements I have made to the default T4 template, and how you can take advantage of this functionality yourself.
>
> -   Part 1 – Generate an IDatabase interface to represent your Data Context
> -   Part 2 - Derive entities from a custom base class
> -   Part 3 – Suppress Code Analysis warnings from the generated code

### Protip before we get started

![](/images/subtext-content/EntityFrameworkT4TemplateEnhancementsPar_A140/image_thumb.png)
Before working with T4, you will absolutely want to install a helpful tool to get syntax highlighting and intellisense. Head into the Visual Studio Extension Manager and search for “Tangible T4 Editor”

After restarting VS, working with T4 templates will become much more enjoyable.

 

### Create the default T4 Template file

The following instructions will create the .TT file from your existing EDMX. Once you have this file in your project you can begin customizing the code generation.

<table>
<colgroup>
<col width="50%" />
<col width="50%" />
</colgroup>
<tbody>
<tr class="odd">
<td><a href="/images/subtext-content/EntityFrameworkT4TemplateEnhancementsPar_A140/image_3.png"><img src="/images/subtext-content/EntityFrameworkT4TemplateEnhancementsPar_A140/image_thumb_3.png" title="image" alt="image" width="240" height="233" /></a> </td>
<td>Open the EDMX Designer, right-click on the design surface, and select “Add Code Generation Item…”</td>
</tr>
<tr class="even">
<td><a href="/images/subtext-content/EntityFrameworkT4TemplateEnhancementsPar_A140/image_4.png"><img src="/images/subtext-content/EntityFrameworkT4TemplateEnhancementsPar_A140/image_thumb_4.png" title="image" alt="image" width="343" height="193" /></a></td>
<td><p>Select the “ADO.NET EntityObject Generator” from the Add New Item dialog</p>
<p><em>Note: The specific details below have only been tested with the standard EntityObject Generator. If you wish to use Self-Tracking entities, the instructions in this post should be sufficient to customize the template yourself.</em></p></td>
</tr>
</tbody>
</table>

 

### Generate an IDatabase to represent your Data Context

Sometimes I want to take advantage of LINQ Projections to create a highly efficient aggregated view of some tables. While I typically prescribe to repositories to gain access into my domain model, I do have certain scenarios where populating a full aggregate and worrying about lazy/eager loading isn’t quite worth the trouble – when I can simply take advantage of LINQ to Entities to generate a highly efficient SQL statement to return exactly what I want.

However, I still want this service to be testable and injectable, without hitting the actual DB/DataContext. For this reason, I wanted to create an IDatabase interface to represent all the tables (object sets) in my datacontext.

**The end result will generate us an IDatabase interface that has an IObjectSet property for each entity in the datacontext, as well as make sure our generated DataContext class implements this interface, so we can simply wire it up with our standard IoC container.**

```csharp
public partial interface IDatabase
{
    IObjectSet<ApplicationFunction> ApplicationFunctions { get; }
    IObjectSet<ArchitecturalDateType> ArchitecturalDateTypes { get; }
    IObjectSet<AuditCode> AuditCodes { get; }
    IObjectSet<Category> Categories { get; }
    IObjectSet<CISRestrictedState> CISRestrictedStates { get; }
    IObjectSet<CommissionExclusion> CommissionExclusions { get; }
    IObjectSet<CommissionInspiration> CommissionInspirations { get; }
    IObjectSet<CommissionPercentage> CommissionPercentages { get; }
}
```

#### Step 1

Go to line 106 (approximate, may vary slightly), you should be under a chunk of code seen below, that does a foreach over each EntityContainer.

Below this code, insert the IDatabase code seen below (I apologize that it’s a screenshot so you cannot copy/paste, but my syntax highlighter was not happy with the T4 syntax for some reason)

![](/images/subtext-content/EntityFrameworkT4TemplateEnhancementsPar_A140/image_thumb_5.png)


#### Step 2

Go to line 126 (also approximate), where your ObjectContext is being generated. You need to make sure that the generated ObjectContext class implements the IDatabase interface we generated earlier.

 ![](/images/subtext-content/EntityFrameworkT4TemplateEnhancementsPar_A140/image_thumb_6.png)


#### Step 3

Next we need to change the properties on the datacontext to be of type IObjectSet instead of the concrete ObjectSet that they default to.

Near line 184, you will see an ObjectSet field and property being generated for each table in your database. Change them from ObjectSet to IObjectSet (in both places), seen in the highlighted portions below.

![](/images/subtext-content/EntityFrameworkT4TemplateEnhancementsPar_A140/image_thumb_7.png)


#### Step 4

Wire up the IDatabase and implementation in your IoC container, now anyone who needs direct access to the Data context can rely on a nice, mockable interface.

 

I hope this helps people get started with T4 and extending the default code generation of EF4. Stay tuned for the next part of the series shortly.

 

