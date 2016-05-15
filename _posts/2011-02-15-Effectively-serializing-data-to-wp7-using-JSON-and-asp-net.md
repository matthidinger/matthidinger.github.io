---
title: "Effectively serializing data to wp7 using JSON and asp.net mvc"
disqus_identifier: http://www.matthidinger.com/archive/2011/02/15/Effectively-serializing-data-to-wp7-using-JSON-and-asp-net.aspx
redirect_from: /archive/2011/02/15/Effectively-serializing-data-to-wp7-using-JSON-and-asp-net.aspx/
tags: 
- wpdev
- aspnet-mvc
---
At [PDC'10 last year](http://www.matthidinger.com/archive/2010/10/28/highlights-from-PDC-day-1.aspx) Microsoft showed their upcoming solution for sharing assemblies between different platforms (Windows Phone, Silverlight, and .NET) – dubbed [Portable Library Projects](http://bit.ly/aUlqkU). The release date is said to be H1 2011 so hopefully they are still on track, maybe even to be included in VS 2010 SP1. Until then, we are on our own…

[Derick Bailey](http://www.lostechies.com/blogs/derickbailey/) actually prompted this post from his tweet a little bit ago, so I figured I would share the solution I used for [Bus Watch Chicago](http://buswatchapp.com/).

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/75137daf93c8_11BCD/image_thumb_5.png)


 

### step 1: define your entities/model in the client (WP7) project

The domain for Bus Watch is public transit, so naturally some of my entities are Routes, Stops, Vehicles, Locations, etc. I define all of these classes in the WP7 project; the Route class can be seen below.

The keen eye may have noticed that I defined Route as a partial class, I will elaborate on that in step 5.

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/75137daf93c8_11BCD/image_thumb_1.png)


 

### step 2: add a “link” to model class in your web project

In your web project (ASP.NET MVC in my case), right-click in your models folder and select **Add –&gt; Existing Item…**

Then navigate to the Client folder and select the entities you plan on serializing and exposing to your client, **but don’t just press Add!** Next to the Add button is a drop-down arrow, open it and make sure you click **Add As Link**

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/75137daf93c8_11BCD/image_thumb_7.png)


Notice how the files have little “shortcut” overlays on their icons.

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/75137daf93c8_11BCD/image_thumb_3.png)


 

### step 3: serialize your model as JSON from the MVC controller

Notice how I am using LINQ projections to convert my “DbRoute” into a Route which can be nicely serialized to JSON in the format that my client is expecting.

```csharp
[OutputCache(Duration = 10000, VaryByParam = "*")]
public ActionResult GetRoutes()
{
    var db = new CtaEntitiesDataContext();
    var routes = db.DbRoutes
                    .OrderBy(r => r.Number)
                    .Select(r => new Route
                                        {
                                            RouteId = r.RouteId,
                                            Name = r.Name,
                                            Directions = r.Directions,
                                            Number = r.Number
                                        });

    return Json(routes, JsonRequestBehavior.AllowGet);
}
```

### step 4: deserialize the JSON on the client

I am using a SerializationHelper to wrap the standard DataContractJsonSerializer built-into .NET, so please feel free to use it.

```csharp
public static class SerializationHelper
{
    public static T Deserialize<T>(string serialized)
    {
        if (string.IsNullOrEmpty(serialized))
            return default(T);

        using (var ms = new MemoryStream(Encoding.UTF8.GetBytes(serialized)))
        {
            var ser = new DataContractJsonSerializer(typeof(T));
            return (T)ser.ReadObject(ms);
        }
    }

    public static string Serialize<T>(T obj)
    {
        var serializer = new DataContractJsonSerializer(obj.GetType());
        using(var ms = new MemoryStream())
        {
            serializer.WriteObject(ms, obj);
            ms.Position = 0;
            var sr = new StreamReader(ms);
            var json = sr.ReadToEnd();
            sr.Close();
            return json;
        }
    }
}
```

 

Next on my client I simply convert the serialized JSON string from my MVC controller into an IEnumerable&lt;Route&gt;. By using a “link” of the Route.cs I ensure that if I add a property to my Route class it will be properly serialized and deserialized on both ends of the transmission.

```csharp
public IEnumerable<Route> ConvertRoutes(string serialized)
{
    return SerializationHelper.Deserialize<IEnumerable<Route>>(serialized);
}
```

### step 5: client-only properties/behavior (optional)

In many real-world apps you will need additional properties and methods on your client-model that don’t actually belong on the server-side. To solve this we will use partial classes.

Notice in the Solution Explorer I have a **RouteClient.cs** which defines the client-only properties and methods of this entity. For example, users of Bus Watch can store their FavoriteStops for a given route, naturally all of this data will be persisted on the client-side of the app, and cannot/should not be sent over from the server. By using a separate .cs file which is not “linked” on the server-side of the application I ensure that the WP7 project gets to interact will the full richness of the Route entity, while the server-side simply has to worry about serializing and proving the appropriate properties to the client.

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/75137daf93c8_11BCD/image_thumb_6.png)


Hopefully this helps someone getting started with wp7dev using ASP.NET MVC!

 

