---
title: "Increase AddIn Performance with MAF and WPF using LoaderOptimization"
disqus_identifier: https://www.matthidinger.com/archive/2008/10/12/increase-addin-performance-with-maf-and-wpf-using-loaderoptimization.aspx
redirect_from: /archive/2008/10/12/increase-addin-performance-with-maf-and-wpf-using-loaderoptimization.aspx/
tags: 
- wpf
- maf
header:
  teaser: 
---
As mentioned in my [previous article](https://blog2.matthidinger.com/archive/2008/10/12/managed-addin-framework-system.addin-with-wpf.aspx), the [Managed AddIn Framework](https://www.codeplex.com/clraddins) supports AppDomain isolation out of the box. This can come in very handy as long as you understand what is really happening under the covers. I am not going to cover all the details of AppDomain isolation and assembly loading within the CLR, but there are plenty of great resources about such things on MSDN. All you need to know for this article is that every .NET assembly much be loaded into memory within an AppDomain, and unless you specifically share assemblies across these domains (as explained below) then they will be loaded into memory for every AppDomain you create. This is particularly important for WPF AddIns, because the WPF assemblies consume a rather generous portion of memory, and since your AddIns are each loaded into their own AppDomain, this means that the WPF assemblies must *also* be loaded into each of these AppDomains. If you are not careful, your application could begin to consume large amounts of memory without you even noticing.

To solve this, you can place an attribute on the Main method of any .NET executable, explicitly stating that you want the CLR to share any assemblies that it can. There are certain rules for an assembly to be shareable, one of which is that it must have a strong name and be placed in the GAC – obviously this is not a problem for the .NET framework assemblies, WPF in our case.

When you create a new WPF Project the project template will create an App.xaml for you. Since WPF does a little magic behind the scenes, there is no way to access the Main method of your application. In this case, you simply delete the App.xaml and create a new Application.cs class with the following code:

```csharp

public class Application : System.Windows.Application
{
    public Application()
    {
        StartupUri = new Uri("Window1.xaml", UriKind.Relative);
    }
    
    public static Application App;

    [System.STAThreadAttribute()]
    [System.Diagnostics.DebuggerNonUserCodeAttribute()]
    [System.LoaderOptimization(LoaderOptimization.MultiDomainHost)]
    public static void Main()
    {
        // Add attribute above this method
        Application app = new Application();
        App = app;
        app.Run();
    }
}
```

