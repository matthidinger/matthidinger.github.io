---
title: "Tidy up MVC forms with a simple HtmlFormHelper"
disqus_identifier: http://www.matthidinger.com/archive/2012/01/10/tidy-up-mvc-forms-with-a-simple-htmlformhelper.aspx
redirect_from: /archive/2012/01/10/tidy-up-mvc-forms-with-a-simple-htmlformhelper.aspx/
tags: 
- aspnet-mvc
---
Many line-of-business applications contain dozens of forms similar to the following, each field consisting of a few common characteristics:

1.  A Label with the name of the field
2.  The field editor itself
3.  Asterisks and special styling for required fields
4.  A tooltip that can be hovered for a detailed description of the field
5.  Validation messages if the input is incorrect

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/1d7e768239e6_E33C/image_thumb_8.png)


To achieve this, we can create the following Model

```csharp
public class ProductInput
{
    [HiddenInput(DisplayValue = false)]
    public int Id { get; set; }

    [Required]
    public string Name { get; set; }

    [Required]
    [Display(Description = "A brief description of the product")]
    [DataType(DataType.MultilineText)]
    public string Description { get; set; }


    [Display(Description = "An optional alternate description of the product to display when featured on the home page")]
    [DataType(DataType.MultilineText)]
    public string FeaturedDescription { get; set; }

    [Required]
    public decimal? Price { get; set; }

    [Display(Description = "Price of the product during a sale")]
    public decimal? SalePrice { get; set; }
}
```

However, when it comes to actually rendering the view,  many MVC forms contain some variation of the following pattern, *repeated over and over for every single field.*

```csharp
<div class="field-wrapper">
    <div class="field-label">
        @Html.LabelFor(m => m.Name)
    </div>
    <div class="field-input">
        @Html.EditorFor(m => m.Name)
        @Html.TooltipFor(m => m.Name)
        @Html.ValidationMessageFor(m => m.Name)
    </div>
</div>
```

While this pattern certainly takes advantage of great MVC functionality like Editor Templates and strongly-typed inputs, it’s clear that this template is going to be pasted all over the application, with a quick rename on the property being rendered. Unfortunately this type of duplication creates 2 distinct problems:

1.  Immediately, it offers no way of styling required fields differently (like adding an asterisk or bolding labels)
2.  It becomes very time consuming to handle a business request like “Please move the tooltip icon before the textboxes instead of after”

To solve this, I use a very simple HtmlFormHelper called FullFieldEditor, which renders the exact same HTML described above, but allows me to easily re-style it in a single place.

The entire View in the screenshot above consists of the following:

```csharp
<form action="" method="post">
    <div class="two-column">
    
        <div class="field-group">
            @Html.FullFieldEditor(m => m.Id)
            @Html.FullFieldEditor(m => m.Name)
            @Html.FullFieldEditor(m => m.Price)
            @Html.FullFieldEditor(m => m.Description)
        </div>
        
        <div class="field-group">
            @Html.FullFieldEditor(m => m.SalePrice)
            @Html.FullFieldEditor(m => m.FeaturedDescription)
        </div>
    </div>
    
    <div class="clear-fix"></div>
    <input type="submit" value="Save"/>
</form>
```

### Source Code

Rather than pasting the full source here, I will be publishing it along with a sample project at <http://mvcgrabbag.codeplex.com>

#### [View the full HtmlFormHelper.cs](http://mvcgrabbag.codeplex.com/SourceControl/changeset/view/dee469477184#MvcGrabBag.Web%2fHelpers%2fHtmlFormHelper.cs "HtmlFormHelper.cs")

 

