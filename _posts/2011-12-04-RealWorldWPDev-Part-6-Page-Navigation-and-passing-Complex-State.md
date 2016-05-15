---
title: "RealWorldWPDev Part 6: Page Navigation and passing Complex State"
disqus_identifier: http://www.matthidinger.com/archive/2011/12/04/RealWorldWPDev-Part-6-Page-Navigation-and-passing-Complex-State.aspx
redirect_from: /archive/2011/12/04/RealWorldWPDev-Part-6-Page-Navigation-and-passing-Complex-State.aspx/
tags: 
- realworldwpdev
---
### Series Introduction and Outline

This series is going to walk through building a polished, functioning Windows Phone app from start to finish. The app is called Realworld Stocks and the [full source code will be available on CodePlex](http://realworldwpdev.codeplex.com/) as the series progresses. I’ll be using Mercurial to encourage forking and maybe even pull requests from developers who want to contribute their own real-world solutions.

[View the Series Introduction and Outline](http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-1-Introduction-and-Outline.aspx)
==============================================================================================================================================

Navigation Basics
-----------------

Even though this series assumes a basic understanding of Windows Phone development I want to briefly touch on the basics of page navigation. Windows Phone apps follow a basic stateless navigation paradigm very similar to that of a web app. Each page in the app is represented by a URL ending with .xaml.

### How to Navigate to a new Page (the bad way)

The simplest way to navigate would be to drop in a Button, add a Click handler for the button, and use the following sample code in your code-behind.

```csharp
NavigationService.Navigate(new Uri("/Views/Home.xaml"));
NavigationService.Navigate(new Uri("/Views/ProductDetails.xaml?ProductID=5&ProductName=HTC%20Titan"));
```

As you can see, if you need to pass parameters to the page you’re navigating to, you use query string values, again exactly how you would write a web application.

### [<img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/b44afa443a77_8012/SNAGHTML1dfd0d9f_thumb.png" title="SNAGHTML1dfd0d9f" alt="SNAGHTML1dfd0d9f" width="592" height="480" />](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/b44afa443a77_8012/SNAGHTML1dfd0d9f.png)

In the first image above we have a ListBox of Stock Symbols. When the user clicks on the MSFT item, we want to navigate to the StockDetailsView.xaml, and tell it which Symbol was clicked on. What we are looking to achieve is something along these lines.

```csharp
NavigationService.Navigate(new Uri("/Views/StockDetailsView.xaml?Symbol=MSFT"));
```

### Accessing QueryString params (the bad way)

Now we are on our new page and need to access the QueryString. So if we open up code-behind for StockDetailsView.xaml.cs we could ** override **OnNavigatedTo**, and access the **NavigationContext.QueryString** dictionary to pull out the params that were passed in.

```csharp
public partial class StockDetailsView : PhoneApplicationPage
{
    public StockDetailsView()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(System.Windows.Navigation.NavigationEventArgs e)
    {
        var symbol = NavigationContext.QueryString["Symbol"];
    }
}
```

Ick. Lots of strings in this scenario, both for navigating to a new URI, and also for pulling query string parameters out.

Strings can prove troublesome for a few reasons:

1.  They are very susceptible to typo’s
2.  They offer no refactoring/renaming support at compile-time.

Thankfully, there’s a better way…

Navigating with Caliburn
------------------------

As I mentioned in a previous post, one of the reasons I love Caliburn is that it provides *just enough* infrastructure to let me develop faster, but not so overbearing that I’m boxed into a corner. One of these infrastructure benefits is navigation on both sides of the equation: navigating to a new page, and pulling out query string params on the new page.

### Navigating with HyperlinkButton and an ActionMessage

In the screenshot above we can see a ListBox showing a list of Stocks. And with this ListBox we naturally have a DataTemplate describing how to render each item. But the really important piece here is that when a specific item is Tapped, we want to load the StockDetails view for that item.

#### HomeWatchListView.xaml

Within HomeWatchListView.xaml we have defined the following DataTemplate, which has a **HyperlinkButton** with something special – **cal:Message.Attach=”LoadSymbol($dataContext)”**

```csharp
<DataTemplate x:Key="WatchListItemTemplate">
    <HyperlinkButton cal:Message.Attach="LoadSymbol($dataContext)">
        <Grid>                
                 <TextBlock Text="{Binding Symbol}"/>
                 <TextBlock Text="{Binding Company}"/>
        </Grid>
    </HyperlinkButton>
</DataTemplate>
```

At first this may look pretty weird. It looks like it’s calling a method named **LoadSymbol()** with some kind of token being passed as **$dataContext** – and that’s exactly what it is.

#### HomeViewModel.cs

Now, in our HomeViewModel we can see exactly where this method is defined. And it does in fact take in a method parameter of type StockSnapshot. Since this is exactly what our ListBox on the view was bound to, were able to use the $dataContext param which represents a single StockSnapshot in the list – specifically, the one that was Tapped.

This give us the added benefit of writing navigation login in our ViewModel and not in our View. ViewModels are more easily testable than Views and can be reused if necessary.

```csharp
public class HomeViewModel : Screen
{
    // ... snip ...

    public void LoadSymbol(StockSnapshot snapshot)
    {
        // TODO: Navigate!
    }
}
```

### How to Navigate to a new Page (the good way)

Caliburn has an **INavigationService** that we use in our ViewModel. It offers 2 major pieces of functionality (and a lot more – see the summary section below!):

1.  Building a URI for us using **\_navigationSerice.UriFor&lt;T&gt;()** – **Look ma’,** **no strings!**
2.  Take the generated URI and Navigate to a new page

```csharp
public void LoadSymbol(StockSnapshot snapshot)
{
    var uri = _navigation.UriFor<StockDetailsViewModel>()
        .WithParam(m => m.Symbol, snapshot.Symbol)
        .BuildUri();

    // BuildUri() returns the following URI
    // /Views/StockDetails/StockDetailsView.xaml?Symbol=MSFT

    _navigation.UriFor<StockDetailsViewModel>()
        .WithParam(m => m.Symbol, snapshot.Symbol)
        .Navigate();
}
```

### Accessing QueryString params (the good way)

Now that we have navigated to StockDetailsView.xaml we need to figure out which Symbol to load – which was passed in via query string. Another great piece of infrastructure is that when a Page is Initialized Caliburn will examine the Page’s QueryString for you. It will look for properties on the ViewModel that match the QueryString parameters and inject them automatically, performing the necessary type coercion (for example, if you ViewModel had a property of type Int.)

That is a long way of saying this: **On your ViewModel, create a property whose name matches a QueryString parameter and it will be injected for you automatically.**

```csharp
public class StockDetailsViewModel : Screen
{
    private string _symbol;

    // This property will be populated automatically because 
    // the incoming querystring has a param named ?Symbol=X
    public string Symbol
    {
        get { return _symbol; }
        set
        {
            _symbol = value;
            NotifyOfPropertyChange(() => Symbol);
        }
    }
}
```

Awesome! No more strings! We are now able build a URI using a strongly typed model with full refactor/rename supporting, **and** able to pull out the query string parameter on the new page without every accessing the Query String directly. I personally find this to be amazingly time saving and allows for very rapid refactoring and enhancements as the app progresses.

Passing complex State between Pages
-----------------------------------

Now there is one final piece to our puzzle. Passing around basic query string primitives is fine, but what if you already have a fully populated complex object model and want to pass that to the next page? This is where things can get a bit muddy.

For this scenario I typically **combine** query strings with a singleton data dump called **GlobalData**. Usually I will create a basic dictionary inside of GlobalData, where I will store the object based on some key, and then pull the object out of GlobalData by using that same key – the key is what I pass around using QueryStrings. The 3 classes working together are outlined below.

#### GlobalData / SnapshotCache

```csharp
public class SnapshotCache : Dictionary<string, StockSnapshot>
{
    public StockSnapshot GetFromCache(string key)
    {
        if (ContainsKey(key))
            return this[key];

        return null;
    }
}

public class GlobalData : NotifyObject
{
    private GlobalData()
    {
            
    }

    private static GlobalData _current;
    public static GlobalData Current
    {
        get
        {
            if (_current == null)
                _current = new GlobalData();

            return _current;
        }
        set { _current = value; }
    }

    private SnapshotCache _cachedStops;
    public SnapshotCache Snapshots
    {
        get
        {
            if (_cachedStops == null)
                _cachedStops = new SnapshotCache();

            return _cachedStops;
        }
    }
}
```

#### Before navigating to a new page, store the object into GlobalData…

```csharp
public class HomeViewModel : Screen
{
    public void LoadSymbol(StockSnapshot snapshot)
    {
        GlobalData.Current.Snapshots[snapshot.Symbol] = snapshot;

        _navigation.UriFor<StockDetailsViewModel>()
             .WithParam(m => m.Symbol, snapshot.Symbol)
             .Navigate();
    }
}
```

#### …on the new page, pull the object out of GlobalData

```csharp
public class StockDetailsViewModel : Screen
{
    private string _symbol;
    public string Symbol
    {
        get { return _symbol; }
        set
        {
            _symbol = value;
            NotifyOfPropertyChange(() => Symbol);
        }
    }

    public StockSnapshot Snapshot
    {
        get { return GlobalData.Current.Snapshots[Symbol]; }
    }
}
```

Summary and further reading
---------------------------

This tutorial covered quite a bit but hopefully didn’t throw too much at you. Page navigation is one of the biggest topics that devs ask me when building their first app, and I highly recommend using Caliburn’s excellent infrastructure to make the task a lot easier.

If you want to dive more into using CM with Windows Phone please check out the following pages:

[Caliburn Docs: Working with Windows Phone](http://caliburnmicro.codeplex.com/wikipage?title=Working%20with%20Windows%20Phone%207%20v1.1&referringTitle=Documentation "http://caliburnmicro.codeplex.com/wikipage?title=Working%20with%20Windows%20Phone%207%20v1.1&referringTitle=Documentation")

[Caliburn Docs: All About Actions](http://caliburnmicro.codeplex.com/wikipage?title=All%20About%20Actions&referringTitle=Documentation "http://caliburnmicro.codeplex.com/wikipage?title=All%20About%20Actions&referringTitle=Documentation")

 

### Want some more RealWorldWPDev?

[View the Series Introduction and Outline](http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-1-Introduction-and-Outline.aspx)
==============================================================================================================================================



