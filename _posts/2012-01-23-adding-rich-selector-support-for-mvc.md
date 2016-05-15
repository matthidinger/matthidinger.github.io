---
title: "Adding rich Selector support for MVC"
disqus_identifier: http://www.matthidinger.com/archive/2012/01/23/adding-rich-selector-support-for-mvc.aspx
redirect_from: /archive/2012/01/23/adding-rich-selector-support-for-mvc.aspx/
tags: 
- aspnet-mvc
---
[<img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Adding-really-rich-Selector-support-for-_8379/image_thumb_2.png" title="image" alt="image" width="550" height="480" />](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Adding-really-rich-Selector-support-for-_8379/image_6.png)

By using the the simple **SelectorAttribute** and **EditorTemplate** described in this post, you will get rich support the following very common scenarios (and flip between the various modes with ease):

1.  **Single** selection from a **Drop Down**
2.  **Single** selection from **Radio Buttons**
3.  **Multiple** selection from **Check Boxes**
4.  **Multiple** selection from a **List Box**
5.  **Read-only** mode combines multiple values into a comma-delimited string

The Canonical example
---------------------

Say you’re inserting a new Product and need to set the **CategoryId** property. You make a simple input Model wanting to use EditorFor, but **CategoryId** gets rendered as a useless textbox. The challenge is:

1.  Retrieving the list of categories to present to the user
2.  Keeping the selected item(s) in sync with the list of choices

```csharp
public class Product
{
    [Required]
    public string Name { get; set; }

    [Required]
    [Display(Name = "Category")]
    public int? CategoryId { get; set; }
}
```

### Enter the SelectorAttribute

**The only change from the model above is the new \[CategorySelector\] attribute on the property.**

#### Single Selection vs. Multiple Selection

Since the \[CategorySelector\] was placed on an int? property, the selector will render in Single-select mode (only one int can be stored into the property). If however, it were a List&lt;int?&gt; property, the selector would render in Multi-select mode, allowing the user to choose more than one int value. I personally find this automatic behavior pretty cool and very helpful!

#### The full model

The screenshot you saw easier is rendered simply by using following Model and EditorFor. The magic lies in the **\[CategorySelector\]** and **\[DisplayModeSelector\]** attributes.

```csharp
public class DisplayModeOptions
{
    public DisplayModeOptions()
    {
        ReadOnly = new List<DisplayMode> { DisplayMode.HomePage, DisplayMode.BrowseOnly};
    }

    [Required]
    [Display(Name = "Category")]
    [CategorySelector]
    public int? CategoryId { get; set; }

    [Required]
    [DisplayModeSelector(BulkSelectionThreshold = 0)]
    public DisplayMode? DropDown { get; set; }

    [Required]
    [DisplayModeSelector]
    public DisplayMode? RadioButtons { get; set; }


    [Required]
    [DisplayModeSelector(BulkSelectionThreshold = 0)]
    public List<DisplayMode> ListBox { get; set; }

    [Required]
    [DisplayModeSelector]
    public List<DisplayMode> CheckBoxes { get; set; }

    [ReadOnly(true)]
    [DisplayModeSelector]
    public List<DisplayMode> ReadOnly { get; set; }
}
```

#### The View is nothing more than

```csharp
<form action="" method="post">
    <div class="two-column">
        <div class="field-group">
            <h4>Single Selection</h4>
            @Html.FullFieldEditor(m => m.RadioButtons)
            @Html.FullFieldEditor(m => m.DropDown)
            @Html.FullFieldEditor(m => m.CategoryId)
        </div>
        
        <div class="field-group">
            <h4>Multiple Selection</h4>
            @Html.FullFieldEditor(m => m.CheckBoxes)
            @Html.FullFieldEditor(m => m.ListBox)
        </div>
    </div>
    <input type="submit" value="Save"/>
</form>
```

### Other helpful features

1.  Respects existing validators like **\[Required\]** and shows a nice custom validation UI on failure
2.  Customizable **OptionLabel** (or don’t show one at all)
3.  If the **SelectorAttribute** is placed on an **IEnumerable** Property it will **automatically** render in multi-selection mode *(notice the difference between the RadioButtons and CheckBoxes property above)*
4.  Automatically converts to **bulk items mode** if the number of choices exceeds your specified threshold. (You wouldn’t really want to show a user 50 checkboxes would you?)
5.  A handy enum helper displays the enum values as the choices in the UI *(seen below in the DisplayModeSelectorAttribute code)*
6.  Of course it retains all user selected values on posts, very common in validation failures

### Creating your own SelectorAttributes

You’ll need to create your own SelectorAttributes in order to specify the list of choices that should be displayed to the user.

The DisplayModeSelector displays all possible choices within an enum.

```csharp
public class DisplayModeSelectorAttribute : SelectorAttribute
{
    public override IEnumerable<SelectListItem> GetItems()
    {
        return Selector.GetItemsFromEnum<DisplayMode>();
    }
}
```

The CategorySelector demonstrates how you might access a database to get a list of items dynamically.

```csharp
public class CategorySelectorAttribute : SelectorAttribute
{
    public CategorySelectorAttribute()
    {
        // The Category selector should always be rendered as a drop down
        BulkSelectionThreshold = 0;
    }

    public override IEnumerable<SelectListItem> GetItems()
    {
        // You could of course get these values from a database, similar to:
        // var dataContext = DependencyResolver.Current.GetService<IDataContext>();

        var categories = new List<Category>
                                {
                                    new Category {Id = 1, Name = "Beverages"},
                                    new Category {Id = 2, Name = "Tools"},
                                    new Category {Id = 3, Name = "Soup"},
                                };
        return Selector.GetItems(categories, m => m.Id, m => m.Name);
    }
}
```

Get the Code!
-------------

Rather than pasting the full source here, I will be publishing it along with a sample project at [**http://mvcgrabbag.codeplex.com**](http://mvcgrabbag.codeplex.com)

#### What you need for Selector support

1.  Selectors\\Selector.cs
2.  Selectors\\SelectorAttribute.cs
3.  Views\\Shared\\EditorTemplates\\Selector.cshtml

#### Pull it down locally

Using [**TortoiseHg**](http://tortoisehg.bitbucket.org/) simply clone the URL: [**https://hg01.codeplex.com/mvcgrabbag**](https://hg01.codeplex.com/mvcgrabbag)

[<img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Adding-really-rich-Selector-support-for-_8379/image_thumb_3.png" title="image" alt="image" width="602" height="189" />](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Adding-really-rich-Selector-support-for-_8379/image_8.png)

#### Browse the code

[**Browse the Selector code, MvcGrabBag.Web/Selectors folder**](http://mvcgrabbag.codeplex.com/SourceControl/changeset/view/2ea3da6732a6#MvcGrabBag.Web%2fSelectors%2fSelectorAttribute.cs)

 

