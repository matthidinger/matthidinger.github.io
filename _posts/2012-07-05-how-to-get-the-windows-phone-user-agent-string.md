---
title: "How to get the Windows Phone user agent string"
disqus_identifier: http://www.matthidinger.com/archive/2012/07/05/how-to-get-the-windows-phone-user-agent-string.aspx
redirect_from: /archive/2012/07/05/how-to-get-the-windows-phone-user-agent-string.aspx/
tags: 
- wpdev
---
[<img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/45d9f34867d2_B652/IE_thumb.png" title="IE" alt="IE" width="194" height="194" />](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/45d9f34867d2_B652/IE_2.png)On a recent project I needed to extract the [windows phone user-agent string](http://windowsteamblog.com/windows_phone/b/wpdev/archive/2011/08/29/introducing-the-ie9-on-windows-phone-mango-user-agent-string.aspx) for our usage analytics, and it had to be the same user-agent as the IE requests. While this didn’t end up being as straight forward and I had hoped, the code below involves a few simple steps. First we have to insert a collapsed browser onto the page, then we can navigate it to specifically crafted HTML/JavaScript, which will in-turn notify the WebBrowser control of it’s user-agent. All you need to do is store it somewhere; in my case, I put it into a custom ApplicationSettings class, but you can store it anywhere you want.

### Usage

Since this code requires adding a WebBrowser control to a page, it’s probably easier to do in code-behind as opposed to a view model.

```csharp
public partial class HomeView : PhoneApplicationPage
{
    public HomeView()
    {
        InitializeComponent();
        Loaded += HomeView_Loaded;
    }

    private void HomeView_Loaded(object sender, RoutedEventArgs e)
    {
        UserAgentHelper.GetUserAgent(
            LayoutRoot,
            userAgent =>
                {
                    // TODO: Store this wherever you want
                    ApplicationSettings.Current.UserAgent = userAgent;
                });
    }
}
```

### The Helper

```csharp
public static class UserAgentHelper
{
    private const string Html =
        @"<!DOCTYPE HTML PUBLIC ""-//W3C//DTD HTML 4.01 Transitional//EN"">

        <html>
        <head>
        <script language=""javascript"" type=""text/javascript"">
            function notifyUA() {
                window.external.notify(navigator.userAgent);
            }
        </script>
        </head>
        <body onload=""notifyUA();""></body>
        </html>";

    public static void GetUserAgent(Panel rootElement, Action<string> callback)
    {
        var browser = new Microsoft.Phone.Controls.WebBrowser();
        browser.IsScriptEnabled = true;
        browser.Visibility = Visibility.Collapsed;
        browser.Loaded += (sender, args) => browser.NavigateToString(Html);
        browser.ScriptNotify += (sender, args) =>
                                    {
                                        string userAgent = args.Value;
                                        rootElement.Children.Remove(browser);
                                        callback(userAgent);
                                    };
        rootElement.Children.Add(browser);
    }
}
```

 

