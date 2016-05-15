---
title: "A simple IndexingObservableCollection for zebra-striping rows"
disqus_identifier: http://www.matthidinger.com/archive/2012/07/02/a-simple-indexingobservablecollection-for-zebra-striping-rows.aspx
redirect_from: /archive/2012/07/02/a-simple-indexingobservablecollection-for-zebra-striping-rows.aspx/
tags: 
- wpdev
- xaml
---
![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/58c4cfa70f46_956D/zebra-camo_thumb.jpg)

I’m currently wrapping up a Windows Phone project and thought this would be a good time to share some of the more reusable stuff we needed.

### Zebra-striping alternate rows

This particular app displays a lot of tabular data, so we wanted to zebra-stripe the rows to make them easier to discern. At first we tried using a ValueConverter to get the index of the current container, but this method didn’t end up working with the [Telerik DataBoundListBox](http://www.telerik.com/products/windows-phone/overview/all-controls.aspx#databoundlistbox).

Instead, we wrote a simple IndexingObservableCollection that will automatically populate the Index of each item as it’s added to the collection. This method also works with the [infinite scrolling feature of Telerik’s listbox](http://www.telerik.com/help/windows-phone/raddataboundlistbox-features-datavirtualization-overview.html) – which we actually needed anyway.

### IndexingObservableCollection

To use it, you have to implement the IIndexable interface which ensure an Index property on your model. Then simply replace the ObservableCollection property on your view-model with the following IndexingObservableCollection.

```csharp
public class IndexingObservableCollection<T> : ObservableCollection<T> where T : IIndexable
{
    protected override void InsertItem(int index, T item)
    {
        item.Index = index;
        base.InsertItem(index, item);
    }

    protected override void SetItem(int index, T item)
    {
        item.Index = index;
        base.SetItem(index, item);
    }
}

public interface IIndexable
{
    int Index { get; set; }
}
```

 

### Tweaking your model

Below is a sample model that could be used for displaying a list of products. In this case I’m returning a specific Brush for odd-numbered rows, and the XAML Grid simply binds Background="{Binding Background}"

```csharp
 
```

```csharp
public class ProductRow : IIndexable
{
    public int Index { get; set; }

    public string ProductName { get; set; }

    public string Price { get; set; }

    public Brush Background
    {
        get
        {
            return Index % 2 == 1
                    ? new SolidColorBrush(Colors.DarkGray)
                    : new SolidColorBrush(Colors.White);
        }
    }
}
```

 

