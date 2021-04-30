---
title: "Progressive enhancement tutorial with ASP.NET MVC 3 and jQuery"
disqus_identifier: https://www.matthidinger.com/archive/2011/02/22/Progressive-enhancement-tutorial-with-ASP-NET-MVC-3-and-jQuery.aspx
redirect_from: /archive/2011/02/22/Progressive-enhancement-tutorial-with-ASP-NET-MVC-3-and-jQuery.aspx/
tags: 
- aspnet-mvc
- jquery
- web-standards
- javascript
header:
  teaser: subtext-content/www_matthidinger_com/Windows-Live-Writer/5a3bbd81a699_12AB1/SNAGHTML1a3b6b08_thumb.png
---
> **Progressive enhancement** is a strategy for [web design](https://en.wikipedia.org/wiki/Web_design) that emphasizes accessibility, [semantic HTML markup](https://en.wikipedia.org/wiki/Semantic_HTML), and external stylesheet and scripting technologies. Progressive enhancement uses web technologies in a layered fashion that allows everyone to access the basic content and functionality of a web page, using any browser or Internet connection, while also providing those with better bandwidth or more advanced browser software an enhanced version of the page.

Now that it’s 2011 I hope more .NET web developers really start to take progressive enhancement seriously. Sure many ASP.NET devs work on internal LOB apps and can enforce javascript requirements, but if you’re working on an internet-facing site I encourage you to take advantage of the many PE/unobtrusive javascript techniques we have available these days, especially in MVC 3.

 

update 3/2/2011
---------------

Per a suggestion from a commenter I have written a followup article that encapsulates the logic presented here into a much more reusable pair of custom ActionResults.

[Progressive enhancement in MVC 3 with the help of custom ActionResults](https://www.matthidinger.com/archive/2011/03/02/Progressive-enhancement-in-MVC-3-with-the-help-of-custom.aspx "https://www.matthidinger.com/archive/2011/03/02/Progressive-enhancement-in-MVC-3-with-the-help-of-custom.aspx")

 

 

Building a Contact Us form
--------------------------

### JavaScript enabled

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/5a3bbd81a699_12AB1/SNAGHTML1a3b6b08_thumb.png)


As you can see when a user visits our site with JavaScript enabled and clicks on the Contact Us link, they are presented with a nice jQuery UI dialog window. They can fill in the form and get a nice confirmation message inside the dialog, and finally close it without ever leaving the page they were on.

### JavaScript disabled

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/5a3bbd81a699_12AB1/SNAGHTML1a48993d_thumb.png)


A visitor without JavaScript will still get the same functionality, just a slightly lesser experience. Without JavaScript logic attached to our Contact Us link it behaves like a plain old hyperlink, navigating the browser to a new page. Once they fill out the form and press Send Message we redirect them back to the Home page with a confirmation message.

### the general idea behind this code

1.  On the server-side (your controller) use Request.IsAjaxRequest() to determine whether the incoming request was invoked via JavaScript or not
2.  Use Partial Views to re-use the same markup in both the Ajax view and the standard view
3.  Use jQuery to make Ajax calls to our Controller, which will return a Partial View of only the HTML we need to display. We then inject this HTML into the DOM where we need it.

### step 1: build our controller (yes, this is the complete controller – with validation too)

You may notice that very little server-side code is required to achieve the functionality seen in the screenshots above.

```csharp
[HttpGet]
public ActionResult ContactUs()
{
    if (Request.IsAjaxRequest())
    {
        return PartialView("_ContactUs");
    }

    return View();
}

[HttpPost]
public ActionResult ContactUs(ContactUsInput input)
{
    // Validate the model being submitted
    if (!ModelState.IsValid)
    {
        // If the incoming request is an Ajax Request 
        // then we just return a partial view (snippet) of HTML 
        // instead of the full page
        if (Request.IsAjaxRequest())
            return PartialView("_ContactUs", input);

        return View(input);
    }

    // TODO: A real app would send some sort of email here

    if (Request.IsAjaxRequest())
    {
        // Same idea as above
        return PartialView("_ThanksForFeedback", input);
    }

    // A standard (non-Ajax) HTTP Post came in
    // set TempData and redirect the user back to the Home page
    TempData["Message"] = string.Format("Thanks for the feedback, {0}! We will contact you shortly.", input.Name);
    return RedirectToAction("Index");
}
```

 

### step 2: wire up our jQuery behavior

One nice thing about a new MVC 3 site is that the VS Project Template actually comes with all the scripts necessary to make this work. Just make sure you reference the following scripts in your \_Layout.cshtml (or Master Page if you don’t yet speak Razor)

**\* Note:** for brevity I am putting the jQuery logic at the bottom of my Layout but in a real-world application this should be moved to an external .js file.

The jQuery code below operates on the following conventions:

1.  Find all hyperlinks with a CSS class of “openDialog”
2.  When the hyperlink is clicked, use the hyperlink’s href to make an Ajax request using .load(this.href) and inject the returned HTML into the DOM
3.  Open the Dialog window

```csharp
<script src="@Url.Content("~/Scripts/jquery-1.4.4.min.js")" type="text/javascript"></script>
<script src="@Url.Content("~/Scripts/jquery-ui.js")" type="text/javascript"></script>
<script src="@Url.Content("~/Scripts/jquery.validate.min.js")" type="text/javascript"></script>
<script src="@Url.Content("~/Scripts/jquery.validate.unobtrusive.min.js")" type="text/javascript"></script>
<script src="@Url.Content("~/Scripts/jquery.unobtrusive-ajax.js")" type="text/javascript"></script>

    
<script type="text/javascript">

    $.ajaxSetup({ cache: false });

    $(document).ready(function () {
        $(".openDialog").live("click", function (e) {
            e.preventDefault();

            $("<div></div>")
                .addClass("dialog")
                .attr("id", $(this).attr("data-dialog-id"))
                .appendTo("body")
                .dialog({
                    title: $(this).attr("data-dialog-title"),
                    close: function () { $(this).remove() },
                    modal: true
                })
                .load(this.href);
        });

        $(".close").live("click", function (e) {
            e.preventDefault();
            $(this).closest(".dialog").dialog("close");
        });
    });
</script>
```

 

### step 3: add the Contact Us hyperlink

The Contact Us hyperlink is just a standard ActionLink with some additional attributes added.

**\* Note:** Sweet! The MVC 3 helpers convert the underscore in HTML attributes to a dash when rendered!

```csharp
@Html.ActionLink("Contact Us", "ContactUs", "Home", null,
       new { @class = "openDialog", data_dialog_id = "emailDialog", data_dialog_title = "Contact Us"})
```

 

The ActionLink renders the following HTML

```csharp
<a class="openDialog" data-dialog-id="emailDialog" 
     data-dialog-title="Contact Us" href="/Home/ContactUs">Contact Us</a>
```

###  

### step 4: create our views

We need to create the following views to wrap up this feature for both the Ajax and plain view.

#### \_ContactUs.cshtml

The partial view (following the Razor/MVC/RoR convention of prefixing partial views with an underscore) is used in both the Ajax experience and the standard experience. This way we don’t need to duplicate the same form in 2 places.

I am using Ajax.BeginForm since MVC 3 renders unobtrusive HTML-5-compatible Ajax attributes, which will will behave perfectly in down-level browsers. Using Ajax.BeginForm gives us client-side and server-side validation in both the Ajax-dialog view and the standard view.

**\*Note:** The UpdateTargetId must match the ID of the dialog window we open with jQuery (in this example I am passing the ID in the Html.ActionLink using data\_dialog\_id). This makes sure that when the form submits and returns a response the HTML will be properly injected into our dialog window.

```csharp
@model ProgressiveEnhancement.Models.ContactUsInput


@using (Ajax.BeginForm(new AjaxOptions { HttpMethod = "POST", UpdateTargetId = "emailDialog" }))
{
    @Html.ValidationSummary(true)
  
    @Html.EditorForModel()

    <p>
        <input type="submit" value="Send Message!" />
    </p>
}
```

 

#### ContactUs.cshtml

Below is the full ContactUs view, used for non-Ajax requests. In this example it just adds a nice &lt;h2&gt; to the page (that we don’t want in our Ajax Dialog view) and then delegates the rest of the rendering to the partial view created above.

```csharp
@model ProgressiveEnhancement.Models.ContactUsInput


<h2>Contact Us</h2>

@Html.Partial("_ContactUs")
```

 

#### \_ThanksForFeedback.cshtml

```csharp
@model ProgressiveEnhancement.Models.ContactUsInput

<p>Thanks for your feedback, @Model.Name! We will contact you shortly.</p>
<p><a href="javascript:void(0);" class="close">Close Window</a></p>
```

 

### Wrap-up and source code

![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/5a3bbd81a699_12AB1/image_thumb_2.png)


Hopefully this tutorial covered everything! It’s exciting to see how far MVC 3 and jQuery have come to really make progressive enhancement a reality with very minimal effort.

 

&lt;-- For reference the final solution structure ended up looking like this

 

[Download the Source](https://buswatchapp.com/downloads/progressiveenhancement.zip)
----------------------------------------------------------------------------------

VS 2010 with ASP.NET MVC 3 required to open it

 

