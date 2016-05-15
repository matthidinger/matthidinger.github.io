---
layout: post
title: "RealWorldWPDev Part 5: Creating and Consuming Web Services"
comments: true
disqus_identifier: http://www.matthidinger.com/archive/2011/11/01/RealWorldWPDev-Part-5-Creating-and-Consuming-Web-Services.aspx
redirect_from: /archive/2011/11/01/RealWorldWPDev-Part-5-Creating-and-Consuming-Web-Services.aspx/
tags: 
- realworldwpdev
---
### Series Introduction and Outline

This series is going to walk through building a polished, functioning Windows Phone app from start to finish. The app is called Realworld Stocks and the [full source code will be available on CodePlex](http://realworldwpdev.codeplex.com/) as the series progresses. I’ll be using Mercurial to encourage forking and maybe even pull requests from developers who want to contribute their own real-world solutions.

[View the Series Introduction and Outline](http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-1-Introduction-and-Outline.aspx)
==============================================================================================================================================

Choices
-------

[<img src="{{ site.baseurl }}images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-5-The-Panorama_12221/image_thumb.png" title="image" alt="image" width="288" height="480" />]({{ site.baseurl }}images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-5-The-Panorama_12221/image_4.png)In the Microsoft world we have no shortage of client and server-side HTTP stacks to choose from. Rather than try to cover every possible combination, and to prevent this topic from getting too long-winded, I will keep this part succinct.

Our first major decisions revolve around the following options:

#### SOAP or REST?

#### WCF or ASP.NET MVC?

Without getting too deep into it, and certainly without suggesting that this is The One True Way, I personally prefer creating REST-based ASP.NET MVC endpoints for the following reasons:

1.  Very simple, flexible routing out of the box
2.  Returning JSON is as simple as return Json()
3.  Model binding/casting of incoming request parameters
4.  Simple ActionFilter attributes add Caching and GZip Compression
5.  No XML configuration, no code/proxy generation, no service references

Creating Services
-----------------

Since we’ve decided to go down the path of ASP.NET MVC for this project, I’m going to walk you through creating services using MVC. If you’ve been following along then you already have your Web project setup. If not, please see [Part 2: File –&gt; New Project](http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-2-File-ndashgt-New-Project.aspx)

### Should I create a middle-man service?

Many mobile apps communicate with some kind of 3rd party service(s). The decision you need to make is whether the phone should connect directly to this service, or if there are benefits to having the mobile app connect to your middle-man web service, which will subsequently contact the third party service. The decision here definitely depends on your specific needs, but there are very real advantages to creating a middle-man service. A few of the benefits of include:

1.  **API Keys** **-** If the third party service requires an API key, storing it on the phone can easily be stolen. If your web server proxies this call for you, it’s much safer being stored there.
2.  **Caching –** Many services will throttle the number of requests you make (using your API key). If you can limit these requests by caching the response on your server, it can greatly improve response times for your users as well as keep your third party service usage lower.
3.  **Shaping the Model** – Many service providers return XML. They may even return a ton of XML that you don’t even care about in your app. If your mobile app contacts your server directly, your server is able to query the third party data and shape it in the most efficient way possible to return to the mobile app, including: Aggregating multiple third-party service calls into one HTTP response to the phone, removing unnecessary elements that the phone app wouldn’t use, and turning the XML into Compressed JSON making it much more compact.

Enough background, implementation time
--------------------------------------

The following will walk you through a pretty efficient way for creating and consuming services, while enhancing them very easily over time. Of course, to get the full idea of how it works in practice, [make sure you pull down the latest code and check it out.](http://realworldwp7.codeplex.com/)

### step 1: Define your entities/model in the WP7 project

In **RealworldStocks.Client.Core** I have a **Models** folder, which include various classes that inherit from **NotifyObject,** seen below.

[<img src="{{ site.baseurl }}images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-5-The-Panorama_12221/SNAGHTML9d234fa6_thumb.png" title="SNAGHTML9d234fa6" alt="SNAGHTML9d234fa6" width="900" height="588" />]({{ site.baseurl }}images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-5-The-Panorama_12221/SNAGHTML9d234fa6.png)

### step 2: “Add as Link” model classes into your Web project

Since you want these same classes to be serialized from your service, you will need them in the web project, but want to keep them in sync as you add, remove, or rename properties. To do this, in **RealWorldStocks.Web**, **right-click in your Models** folder and select **Add –&gt; Existing Item…**

Then navigate to the **RealWorldStocks.Client.Core\\Models** folder and select the entities you plan on serializing and exposing to your client, **but don’t just press Add!** Next to the Add button is a drop-down arrow, open it and make sure you click **Add As Link**

[<img src="{{ site.baseurl }}images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-5-The-Panorama_12221/image_thumb_2.png" title="image" alt="image" width="900" height="557" />]({{ site.baseurl }}images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-5-The-Panorama_12221/image_6.png)

Notice how the files have little “shortcut” overlays on their icons.

##### [<img src="{{ site.baseurl }}images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-5-The-Panorama_12221/image_thumb_3.png" title="image" alt="image" width="310" height="513" />]({{ site.baseurl }}images/subtext-content/www_matthidinger_com/Windows-Live-Writer/RealWorldWPDev-Part-5-The-Panorama_12221/image_8.png)

### step 3: Return your data as JSON from the MVC controller

Below is the complete **StocksController** for exposing Snapshots and getting the latest News articles. The following code covers a number of concepts from the beginning of this post. I encourage you to check out the full source code to get an understanding of how they work under the covers.

1.  **\[AllowJsonGet\]** – This attribute works around an MVC 2 security feature that makes you explicitly return JSON from HTTP GET requests
2.  **\[NoCache\]** – The WebClient in WP7 will cache requests for you automatically. This can catch you off guard and cause very subtle bugs if you aren’t careful. This attribute will add the appropriate HTTP cache-control headers to our response telling the app not to cache the returned JSON. If we didn’t have this, every time we requested an update for the MSFT symbol, we would immediately get back the phone-cached previous response without even trying to contact the server.
3.  **\[Compress\]** – This attribute checks the incoming Accept-Encoding of the request, and if it supports GZip, will automatically GZip compress the outgoing response. Our Windows Phone app uses the **SharpGIS**.**GZipWebClient** to decompress it – discussed below.
4.  **\[OutputCache\]** – On The **GetSnapshot** method below there is an **OutputCache with a Duration of 60**. This attribute instructs MVC to return a cached version of this response as long as the incoming route parameters are the same – in this case, if the same Symbol is requested. This means that if multiple Realworld Stocks users out there are all request a snapshot of MSFT, our service will cache this for 60 seconds and give them all the same response, rather than hitting Yahoo every single time.

``` brush:
[AllowJsonGet]
[NoCache]
[Compress]
public class StocksController : Controller
{
    private readonly IStocksService _stocksService;
    private readonly INewsService _newsService;

    public StocksController()
    {
        _stocksService = new YahooStocksService();
        _newsService = new FakeNewsService();
    }

    public ActionResult GetSnapshots(string[] symbols)
    {
        var model = _stocksService.GetSnapshots(symbols);
        return Json(model);
    }

    public ActionResult GetNews(string[] symbols)
    {
        var model = _newsService.GetNews(symbols);
        return Json(model);
    }


    [OutputCache(Duration = 60)]
    public ActionResult GetSnapshot(string symbol)
    {
        return GetSnapshots(new[] { symbol });
    }
}
```

#### Test it!

If everything goes as planned you should be able to hit this URL in a browser. On my machine hosted under IIS, the URL is:

<http://localhost/RealWorldStocks.Web/Stocks/GetSnapshots?symbols=MSFT&symbols=NOK>

### step 4: Creating a robust HttpClient

Now that we have our service up there and returning JSON, let’s start consuming it from the app. The following HttpClient handles a number of concerns on our behalf.

1.  GZip Compression using [SharpGIS.GZipWebClient](http://www.sharpgis.net/post/2011/08/28/GZIP-Compressed-Web-Requests-in-WP7-Take-2.aspx) (can be found on NuGet!)
2.  Timeout Support to automatically kill requests that take too long (30 seconds by default)
3.  Logging requests and responses in the Debug window
4.  Deserializing the JSON into the specific Model type automatically

``` brush:
public static class HttpClient
{
    public static TimeSpan Timeout = TimeSpan.FromSeconds(30);

    public static void BeginRequest<T>(HttpRequest<T> request, Action<HttpResponse<T>> callback)
    {
        BeginRequest(request.Url, callback);
    }

    public static void BeginRequest<T>(string url, Action<HttpResponse<T>> callback)
    {
        var client = new GZipWebClient();

        var timer = new Timer(state => client.CancelAsync(), null, Timeout, TimeSpan.FromMilliseconds(-1));
            
        Debug.WriteLine("HTTP Request: {0}", url);
        client.DownloadStringCompleted += (s, e) => ProcessResponse(callback, e);
        client.DownloadStringAsync(new Uri(url, UriKind.Absolute), timer);
    }

    private static void ProcessResponse<T>(Action<HttpResponse<T>> callback, DownloadStringCompletedEventArgs e)
    {
        var timer = (Timer) e.UserState;
        if (timer != null)
            timer.Dispose();

        try
        {
            if (e.Error == null)
            {
                string json = e.Result.Replace("&amp;", "&");
                Debug.WriteLine("HTTP Response: {0}\r\n", json);
                var model = SerializationHelper.Deserialize<T>(json);

                Deployment.Current.Dispatcher.BeginInvoke(() => callback(new HttpResponse<T>(model)));
            }
            else
            {
                throw new WebException("Error getting the web service data", e.Error);
            }
        }
        catch (SerializationException ex)
        {
            var httpException = new HttpException("Unable to deserialize the model", ex);
            Debug.WriteLine(ex);
            Deployment.Current.Dispatcher.BeginInvoke(() => callback(new HttpResponse<T>(httpException)));
        }
        catch (WebException ex)
        {
            var httpException = new HttpException(ex);
            Debug.WriteLine(ex);
            Deployment.Current.Dispatcher.BeginInvoke(() => callback(new HttpResponse<T>(httpException)));
        }
    }
}
```

#### Logging

The logging is helpful to see the following in the Debug window as you’re testing the app.

``` brush:
INFO: HTTP Request: http://legacy/RealWorldStocks.Web/Stocks/GetSnapshots?symbols=MSFT&symbols=NOK&symbols=AAPL&isTrial=False&clientVersion=1.0.0.0
INFO: HTTP Response: [{"Symbol":"MSFT","Company":"Microsoft Corpora","OpeningPrice":27.08,"LastPrice":27.19,"DaysChange":0.03,"DaysChangePercentFormatted":"+0.11%","DaysChangeFormatted":"+0.03","DaysRangeMin":0,"DaysRangeMax":0,"Volume":56897792,"PreviousClose":27.16}]
```

####  

### step 5: Create the client-side API for communicating with the server

Calling an HTTP endpoint is as simple as declaring the URL along with any query string parameters to customize the request. Since we definitely don’t want to spread this implementation detail all through our code-base, we write a simple abstraction which handles the following:

1.  Declares what type of model is returned from the server by defining the method as HttpRequest&lt;T&gt; where T is what is returned from the server
2.  Declares the base URL path for the request, e.g., “Stocks/GetSnapshot”
3.  Builds up any query string params that will be sent with the request.
4.  Essentially, it builds a string like the following, and automatically parses the JSON into the type of Model we expect from the server: <http://localhost/RealWorldStocks.Web/Stocks/GetSnapshots?symbols=MSFT&symbols=NOK>

``` brush:
public class StocksWebService : HttpService, IStocksWebService
{
    public StocksWebService()
    {
#if DEBUG
        BaseUrl = DynamicLocalhost.ReplaceLocalhost("http://localhost/RealWorldStocks.Web/");
#else
        BaseUrl = "http://services.mydomain.com/v1/";
#endif
    }

    public HttpRequest<StockSnapshot> GetSnapshot(string symbol)
    {
        var queryString = new QueryString
                                {
                                    {"symbol", symbol}
                                };

        return CreateHttpRequest<StockSnapshot>("Stocks/GetSnapshot", queryString);
    }

    public HttpRequest<IEnumerable<StockSnapshot>> GetWatchListSnapshots()
    {
        var queryString = new QueryString();
        queryString.AddMany("symbols", WatchList.Current.Select(m => m.Symbol));

        return CreateHttpRequest<IEnumerable<StockSnapshot>>("Stocks/GetSnapshots", queryString);
    }

    public HttpRequest<IEnumerable<News>> GetNewsForWatchList()
    {
        var queryString = new QueryString();
        queryString.AddMany("symbols", WatchList.Current.Select(m => m.Symbol));

        return CreateHttpRequest<IEnumerable<News>>("Stocks/GetNews", queryString);
    }
}
```

#### DynamicLocalhost

DynamicLocalhost is a NuGet package I wrote to make debugging services on multiple machines with multiple developers easier.

[You can read more about the DynamicLocalhost package here](http://www.matthidinger.com/archive/2011/10/10/DynamicLocalhost-NuGet-Package-for-Windows-Phone.aspx).

### step 6: Bringing it all together – Orchestrating the request from the ViewModel

It seems like a lot of code just to get this far, but most of this stuff is infrastructure that I just copy/paste into all of my projects. Without these infrastructure concerns I am able to just start writing the controller methods, and defining the client-side API for the requests. From there I just start using it from the ViewModel, all in a matter of 5 minutes.

#### Coroutines - Making async sexy since C\# 2

As a quick aside I wanted to talk about coroutines. One of these amazing things was first introduced to me in Rob Eisenberg’s Build your own MVVM Framework talk from MIX ‘10. It was an excellent talk, and the inspiration for the Caliburn.Micro project.

The **Coroutine** is the **UpdateWatchList** method below.

1.  Show the global BusyIndictator with a friendly loading message
2.  Making an **async** HTTP Request
3.  When we get the HTTP Response, check if it had an error, if so show a friendly MessageBox
4.  If it returned successfully then we bind the data to our ObservableCollection so the UI will update itself
5.  Hide the global BusyIndicator

**This is actually a lot of stuff going on, and it’s async. Notice how there are no lambdas, no callbacks, no anonymous method delegates? It’s really quite elegant, and has suited me very nicely while I patiently wait for C\# 5 and official async compiler support.**

``` brush:
private IEnumerable<IResult> UpdateWatchList()
{
    BusyIndictator.Show("Loading watch list...");
    var request = _stocksWebService.GetWatchListSnapshots().Execute();
    yield return request;

    if (!request.Response.HasError)
    {
        WatchList.RepopulateObservableCollection(request.Response.Model);
    }
    else
    {
        MessageBox.Show("We had troubles updating your watch list, please try again in a few moments", 
            "Unable to contact server", MessageBoxButton.OK);
    }

    yield return BusyIndictator.HideResult();
}
```

###  

Summary
-------

That covered a lot of stuff. My hope is that it wasn’t too daunting or overwhelming – a lot of this code really is reusable infrastructure stuff that can just be pasted into any project and used right-away. I would love feedback from people, particularly those who choose a different path, like WCF and Service References.

### Want some more RealWorldWPDev?

[View the Series Introduction and Outline](http://www.matthidinger.com/archive/2011/10/16/RealWorldWPDev-Part-1-Introduction-and-Outline.aspx)
==============================================================================================================================================



