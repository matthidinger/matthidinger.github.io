---
title: "Progressive enhancement in MVC 3 with the help of custom ActionResults"
disqus_identifier: http://www.matthidinger.com/archive/2011/03/02/Progressive-enhancement-in-MVC-3-with-the-help-of-custom.aspx
redirect_from: /archive/2011/03/02/Progressive-enhancement-in-MVC-3-with-the-help-of-custom.aspx/
tags: 
- aspnet-mvc
- jquery
- web-standards
- javascript
---
Last week I wrote a tutorial on [Progressive enhancement with ASP.NET MVC 3 and jQuery](http://www.matthidinger.com/archive/2011/02/22/Progressive-enhancement-tutorial-with-ASP-NET-MVC-3-and-jQuery.aspx). It might be a good idea to skim it if you aren’t already familiar with some of the concepts.

A commenter on the last article posed a great question which sparked some improvements to the original code. Thanks for the suggestion!

Quick Recap
-----------

As a quick recap, our goal is to build a Contact Us form that works perfectly on all browsers, but offers an enhanced experience for modern browsers with JavaScript enabled.

### JavaScript enabled

[<img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Progressive-enhancement-with-MVC-3-take-_14529/SNAGHTML1a3b6b08_thumb4_thumb_1.png" title="SNAGHTML1a3b6b08_thumb4" alt="SNAGHTML1a3b6b08_thumb4" width="772" height="219" />](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Progressive-enhancement-with-MVC-3-take-_14529/SNAGHTML1a3b6b08_thumb4_4.png)

As you can see when a user visits our site with JavaScript enabled and clicks on the Contact Us link, they are presented with a nice jQuery UI dialog window. They can fill in the form and get a nice confirmation message inside the dialog, and finally close it without ever leaving the page they were on.

### JavaScript disabled

[<img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Progressive-enhancement-with-MVC-3-take-_14529/SNAGHTML1a48993d_thumb1_thumb.png" title="SNAGHTML1a48993d_thumb1" alt="SNAGHTML1a48993d_thumb1" width="772" height="219" />](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Progressive-enhancement-with-MVC-3-take-_14529/SNAGHTML1a48993d_thumb1_2.png)

A visitor without JavaScript will still get the same functionality, just a slightly lesser experience. Without JavaScript logic attached to our Contact Us link it behaves like a plain old hyperlink, navigating the browser to a new page. Once they fill out the form and press Send Message we redirect them back to the Home page with a confirmation message.

 

### The new Controller

Per the suggestion from the commenter, I have abstracted the logic into two custom ActionResults named **AjaxableViewResult** and **AjaxableActionResult**. Our new controller is much more concise and readable provided we adhere to some conventions for naming our views.

 

```csharp
[HttpGet]
public ActionResult ContactUs()
{
    return new AjaxableViewResult();
}

[HttpPost]
public ActionResult ContactUs(ContactUsInput input)
{
    if (!ModelState.IsValid)
        return new AjaxableViewResult(input);

    // TODO: A real app would send some sort of email here

    TempData["Message"] = string.Format("Thanks for the feedback, {0}! We will contact you shortly.", input.Name);
    return new AjaxableActionResult
                {
                    DefaultResult = () => RedirectToAction("Index"),
                    AjaxResult = () => PartialView("_ThanksForFeedback", input)
                };
}
```

 

### The Code

Below you will find the code that abstracts our progressive enhancement logic. The code is documented and should be relatively straight-forward if you’re familiar with MVC’s concept of ActionResults.

#### AjaxableActionResult

```csharp
/// <summary>
/// Executes a specific action result depending on whether the incoming request is an Ajax request or not
/// </summary>
public class AjaxableActionResult : ActionResult
{
    /// <summary>
    /// The result to execute for non-Ajax requests
    /// </summary>
    public Func<ActionResult> DefaultResult { get; set; }

    /// <summary>
    /// The result the execute for Ajax requests
    /// </summary>
    public Func<ActionResult> AjaxResult { get; set; }

    public override void ExecuteResult(ControllerContext context)
    {
        if(DefaultResult == null)
            throw new ArgumentException("The DefaultResult property must be set");

        if (AjaxResult == null)
            throw new ArgumentException("The AjaxResult property must be set");


        if (context.HttpContext.Request.IsAjaxRequest())
        {
            AjaxResult().ExecuteResult(context);
        }
        else
        {
            DefaultResult().ExecuteResult(context);
        }
    }
}
```

 

#### AjaxableViewResult

```csharp
/// <summary>
/// Inspects the incoming request and returns a PartialViewResult for Ajax requests and a full ViewResult for non-Ajax requests
/// </summary>
public class AjaxableViewResult : ActionResult
{
    /// <summary>
    /// Determines the convention for looking up a PartialView for the incoming request. 
    /// The default convention looks for an underscore followed by the action name. 
    /// For example: _ContactUs.cshtml or _ContactUs.ascx
    /// </summary>
    public static Func<ControllerContext, string> AjaxViewNameConvention = context => "_" + context.RouteData.GetRequiredString("action");

    /// <summary>
    /// The view name for non-Ajax requests
    /// </summary>
    public string NonAjaxViewName { get; set; }

    /// <summary>
    /// The view name for Ajax requests
    /// </summary>
    public string AjaxViewName { get; set; }

    /// <summary>
    /// The model that is rendered to the view
    /// </summary>
    public object Model { get; set; }

    /// <summary>
    /// Creates a new AjaxableViewResult using the default conventions
    /// </summary>
    public AjaxableViewResult() : this(null, null, null)
    {
            
    }

    /// <summary>
    /// Creates a new AjaxableViewResult using the default conventions with custom model data
    /// </summary>
    public AjaxableViewResult(object model) : this(null, null, model)
    {
    
    }

    /// <summary>
    /// Creates a new AjaxableViewResult with a specific ajax partial view
    /// </summary>
    public AjaxableViewResult(string ajaxViewName) : this(ajaxViewName, null)
    {
            
    }

    /// <summary>
    /// Creates a new AjaxableViewResult with a specific ajax partial view and model
    /// </summary>
    public AjaxableViewResult(string ajaxViewName, object model) : this(ajaxViewName, null, model)
    {
            
    }

    /// <summary>
    /// Creates a new AjaxableViewResult with a specific ajax view, non-ajax view, and model
    /// </summary>
    public AjaxableViewResult(string ajaxViewName, string defaultViewName, object model)
    {
        NonAjaxViewName = defaultViewName;
        AjaxViewName = ajaxViewName;
        Model = model;
    }


    public override void ExecuteResult(ControllerContext context)
    {
        context.Controller.ViewData.Model = Model;

        if (context.HttpContext.Request.IsAjaxRequest())
        {
            var view = new PartialViewResult
                            {
                                ViewName = GetAjaxViewName(context),
                                ViewData = context.Controller.ViewData
                            };

            view.ExecuteResult(context);
        }
        else
        {
            var view = new ViewResult
            {
                ViewName = GetViewName(context),
                ViewData = context.Controller.ViewData
            };

            view.ExecuteResult(context);    
        }

    }

    private string GetViewName(ControllerContext context)
    {
        return !string.IsNullOrEmpty(NonAjaxViewName) ? NonAjaxViewName : context.RouteData.GetRequiredString("action");
    }

    private string GetAjaxViewName(ControllerContext context)
    {
        return !string.IsNullOrEmpty(AjaxViewName) ? AjaxViewName : AjaxViewNameConvention(context);
    }
}
```

 

 

### Overriding the AjaxViewName convention

For completeness I decided to add a simple extensibility point to change the Ajax view lookup convention. In your Global.asax you can use the static AjaxViewNameConvention to define your own partial view convention, the default looks for an underscore before the action name.

 

```csharp
protected void Application_Start()
{
    AreaRegistration.RegisterAllAreas();

    AjaxableViewResult.AjaxViewNameConvention = 
        context => "_" + context.RouteData.GetRequiredString("action");

    RegisterGlobalFilters(GlobalFilters.Filters);
    RegisterRoutes(RouteTable.Routes);
}
```

 

### Wrap-up and source code

Thanks again to the commenter who sparked these improvements!  The full source code is attached to this post, hopefully it helps someone!

[download the source](http://buswatchapp.com/downloads/progressiveenhancement2.zip)
-----------------------------------------------------------------------------------

 

