---
title: "Getting around the missing MouseClick event on the WP7 Bing Maps control"
disqus_identifier: http://www.matthidinger.com/archive/2011/04/03/Getting-around-the-missing-MapClick-event-on-the-WP7-Bing.aspx
redirect_from: /archive/2011/04/03/Getting-around-the-missing-MapClick-event-on-the-WP7-Bing.aspx/
tags: 
- wpdev
- bing-maps
- blend
- silverlight
---
update
------

I’ve updated the code to check for the MapZoom event; also fixed a typo of MapClick to MouseClick.

 

Original Post
-------------

The Windows Phone Bing Maps control is very close to its desktop Silverlight counterpart, with few missing features. In fact none of the limitations have really impacted my phone projects, until today I ran into a peculiarly missing event: **MouseClick**.

Without MapClick there is no built-in way (to my knowledge) to detect when the user taps on the map. The Map control unfortunately swallows all ManipulationCompleted events, and MouseLeftButtonUp/Down get fired even when the user pans or zooms the map, which we don’t want to concern ourselves with.

### Blend Triggers to the rescue

The solution I came up with is a Trigger called MapTapTrigger. In meeting with a number of other WP7 developers over the past year I came to the realization that many of them don’t use Blend often, and even fewer have used the very helpful Trigger feature. With that in mind you really owe it to yourself to get more familiar with Blend when you can!

####  

#### Defining triggers in Blend

In my scenario, I have a visual state on my page called “MapOnlyState” which transitions the map to full screen. I wanted to activate this state when the Map was tapped on. This scenario is very easy to achieve in Blend.

1.  From the tools chevron in the search dialog type “GoToStateAction” and drag it onto your map
2.  With the GoToStateAction selected, look in the Property pane: the default Trigger will be an EventTrigger, which by itself allows you to select any event on the control to invoke the trigger
3.  Click the New button to choose a different trigger. Select the MapTapTrigger *(after you’ve added the code below to your project and compiled!)* 

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/f558d26ebae1_B4AB/SNAGHTML64ad1bd5_thumb.png)


####  

#### Defining Triggers in XAML

The steps above generate the following XAML, which you could of course write yourself in Visual Studio if you wanted.

```csharp
<m:Map x:Name="map">
    <Custom:Interaction.Triggers>
        <Controls:MapTapTrigger>
            <ic:GoToStateAction StateName="MapOnlyState"/>
        </Controls:MapTapTrigger>
    </Custom:Interaction.Triggers>
</m:Map>
```

 

### MapTapTrigger code

To use this trigger simply paste the class into your project and compile. Blend will find it automatically when the Select Object window opens.

```csharp
public class MapTapTrigger : TriggerBase<Map>
{
    private bool _isTapOnly = true;

    /// <summary>
    /// Attach from the appropriate events.
    /// </summary>
    protected override void OnAttached()
    {
        base.OnAttached();
        AssociatedObject.MapZoom += MapZoom;
        AssociatedObject.MapPan += MapPan;
        AssociatedObject.MouseLeftButtonUp += MouseLeftButtonUp;
    }

    private void MapZoom(object sender, MapZoomEventArgs e)
    {
        _isTapOnly = false;
    }

    private void MapPan(object sender, MapDragEventArgs e)
    {
        _isTapOnly = false;
    }

    private void MouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        if (_isTapOnly)
        {
            InvokeActions(e);
        }
        _isTapOnly = true;
    }

    /// <summary>
    /// Detach from the appropriate events.
    /// </summary>
    protected override void OnDetaching()
    {
        base.OnDetaching();
        AssociatedObject.MapZoom -= MapZoom;
        AssociatedObject.MapPan -= MapPan;
        AssociatedObject.MouseLeftButtonUp -= MouseLeftButtonUp;
    }
}
```



