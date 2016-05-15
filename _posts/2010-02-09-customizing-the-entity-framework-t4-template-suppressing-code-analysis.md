---
title: "Customizing the Entity Framework T4 Template, suppressing code analysis"
disqus_identifier: http://www.matthidinger.com/archive/2010/02/09/customizing-the-entity-framework-t4-template-suppressing-code-analysis.aspx
redirect_from: /archive/2010/02/09/customizing-the-entity-framework-t4-template-suppressing-code-analysis.aspx/
tags: 
- entity-framework
- ef4
---
As a brief recap, the reason this post even exists is because the generated code from the EF4 designer [does not properly suppress code analysis warnings](http://matthidinger.com/archive/2010/02/04/ef4-edmx-does-not-suppress-code-analysis-warnings.aspx). In that post, I mentioned that I would provide a proper T4 template and tutorial on integrating it into your EDMX model. This post details the steps to creating and customizing an Entity Framework 4 T4 template.

[T4](http://www.hanselman.com/blog/T4TextTemplateTransformationToolkitCodeGenerationBestKeptVisualStudioSecret.aspx) (the [Text Template Transformation Toolkit](http://msdn.microsoft.com/en-us/library/bb126445.aspx)) is the code generation technology built into Visual Studio. Thankfully, the EF4 designer has been enhanced to support customizable templates so that developers are free to change the code that is generated for your ObjectContext and Entity classes.

To get started, I am assuming you already have an EDMX file that has been generated from your database.

### Beta Note

These steps were written for **Visual Studio 2010 Beta 2**, so they may change slightly before RTM.

### Step 1

Open the EDMX Designer, right-click on the design surface, and select “Add Code Generation Item…”

![](/images/subtext-content/CustomizingtheEntityFrameworkT4Templates_DCCE/addcodegenitem_thumb.png)
 

### Step 2

Select the “ADO.NET EntityObject Generator” from the Add New Item dialog

*Note: The specific instructions below only work for the standard EntityObject Generator, and will not apply directly to the Self-Tracking Entities template. If you wish to use Self-Tracking entities, the instructions in this post should be sufficient to customize the template yourself.*

![](/images/subtext-content/CustomizingtheEntityFrameworkT4Templates_DCCE/image_thumb.png)


Now you should have a new EfModel.tt file in your project. This is the T4 template that the EDMX designer will use to generate the classes that represent your EDMX model.

### Step 3

Open the newly created EfModel.tt file.

From here, you can customize the template yourself (instructions are provided in Step 3b, or simply download the T4 template that I have provided in Step 3a)

 

#### Step 3a – Download the corrected template

1.  [Open the T4 Template](http://www.matthidinger.com/downloads/codesnippets/edmxt4template.txt)
2.  Overwrite all text in your .tt file with the text from the link above
3.  Change the token “YOUR\_EDMX\_FILE.edmx” to be the file name of you actual edmx file
4.  Proceed to step 4

 

#### Step 3b - Customize your template manually

To suppress code analysis, you need to decorate each class definition with a `[GeneratedCode]` attribute, as follows:

`      [global::System.CodeDom.Compiler.GeneratedCode("EdmxTool", "1.0.0.0")]`

You can use the standard Visual Studio Find dialog to find all instances where classes are being generated. In the Template that I am using (The one that shipped with Visual Studio 2010 Beta 2) there were 3 places to decorate the code.

1.  The ObjectContext class
2.  The Entity classes
3.  The ComplexType classes

Following is a snippet from my modified ObjectContext generation.

```csharp
/// <summary>
/// <#=SummaryComment(container)#>
/// </summary><#=LongDescriptionCommentElement(container, region.CurrentIndentLevel)#>
[global::System.CodeDom.Compiler.GeneratedCode("EdmxTool", "1.0.0.0")]
<#=Accessibility.ForType(container)#> partial class <#=code.Escape(container)#> : ObjectContext
```

Repeat this process for the 3 remaining class definitions by using the standard Find… dialog. I found it easiest to search for the text “partial class”

### Step 4

Open the EDMX designer and Ctrl+S to save it.

If all goes correctly, the T4 template should kick into action and a new .cs file should be created. This .cs file includes the actual generated code based on your EDMX model and your T4 template. As always with generated code don’t attempt to modify it directly, since the next time you (or someone else) saves the edmx file it will overwrite any changes you made.

Lastly, one final benefit of all of this is that you can make any changes in the T4 template to fully customize how your entities are generated from now on.

 

