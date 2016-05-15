---
title: "Tweaking Subtext with Hero Shots next to each post"
disqus_identifier: http://www.matthidinger.com/archive/2011/12/12/tweaking-subtext-with-hero-shots-next-to-each-post.aspx
redirect_from: /archive/2011/12/12/tweaking-subtext-with-hero-shots-next-to-each-post.aspx/
tags: 
- subtext
- open-source
header:
  teaser: subtext-content/www_matthidinger_com/Windows-Live-Writer/Modify_8E10/image_thumb_1.png
---
![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Modify_8E10/image_thumb_1.png)

This past weekend I decided to upgrade my Subtext blog to VS 2010 so I could finally rid my machine of VS 2008. After some small hiccups it was ready to rock, and thankfully the deployment to my server was entirely painless with WebDeploy.

So being in VS 2010 and having fully tested my deployment process it seemed like a good time to make a tweak to my Skin that I’ve been wanting to try for a while: showing “Hero Shots” next to each post.

Hero shots?
-----------

I’m not really sure what they should be called, I just know I’ve heard the term hero shot a lot this year and it seemed to fit, but call it whatever you want <img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/Modify_8E10/wlEmoticon-winkingsmile_2.png" alt="Winking smile" class="wlEmoticon wlEmoticon-winkingsmile" />

The idea is pretty simple: when viewing a list of posts (the home page, a specific tag, the archives) I want to show an image that helps illustrate the topic and allow for easier scanning with the eye.

As for implementation I wanted to allow some basic configuration of the hero shot from within Live Writer (or whatever you use to author posts). It goes something like this:

1.  Find an &lt;img id=”hero” /&gt; within each post and if found, float it inline with the PostText
2.  If no images have that ID, then grab the first &lt;img/&gt; and float it inline with the PostText
3.  If I want to entirely disable a Hero Shot for a post then I just add a &lt;div id=”no-hero” /&gt; into the post body

Cool, what’s the tweak?
-----------------------

First I used NuGet to get HtmlAgilityPack – the absolute best way to work with an HTML string.

#### Install-Package HtmlAgilityPack

With that installed the change to Subtext was actually really simple. Within EntryList.cs I found where it was binding the Post Text and added the BindHeroShot() method seen below. BindHeroShot encapsulates that logic described above. The code below will respect Skins which do not use the PostImage, so this change should not affect any themes without a PostImage control declared.

#### Subtext.Web\\UI\\Controls\\EntryList.cs

```csharp
private void BindPostText(RepeaterItemEventArgs e, Entry entry)
{
    BindHeroShot(e, entry);

    var postText = (Literal)e.Item.FindControl("PostText");

    if(DescriptionOnly)
    {
        postText.Text = entry.HasDescription
                ? string.Format(CultureInfo.InvariantCulture, "<p>{0}</p>", entry.Description)
                : ShowTruncatedBody(entry, 150);
    }
    else
    {
        postText.Text = entry.HasDescription ? entry.Description : entry.Body;
    }
}


/// <summary>
///  Get the first image in a post to use as the "Hero Shot" on the list of entries
/// </summary>
private static void BindHeroShot(RepeaterItemEventArgs e, Entry entry)
{
    var postImage = e.Item.FindControl("PostImage") as System.Web.UI.WebControls.Image;
    if (postImage != null)
    {
        postImage.Visible = false;

        var html = new HtmlDocument();
        html.LoadHtml(entry.Body);

        var noHero = html.DocumentNode.SelectSingleNode("//div[@id='no-hero']");
        if (noHero != null)
            return;

        var img = html.DocumentNode.SelectSingleNode("//img[@id='hero']")
                  ?? html.DocumentNode.SelectSingleNode("//img");
                
        if (img != null)
        {
            postImage.Visible = true;
            postImage.ImageUrl = HttpUtility.HtmlDecode(img.Attributes["src"].Value);
        }
    }
}
```

That’s actually all that had to be changed in Subtext. The rest of the changes take place in your current Skin.

 

#### Subtext.Web\\Skins\\{YourSkin}\\EntryList.ascx

Below is the Repeater which shows each Post, the only thing I added to it was an **&lt;asp:Image ID=”PostImage”/&gt;**

```csharp
<asp:Repeater runat="server" ID="Entries" OnItemCreated="PostCreated">
    <ItemTemplate>
        <div class="post">
            <div class="title">
                <asp:HyperLink runat="server" ID="TitleUrl" />
                <asp:HyperLink runat="server" ID="editLink" />
            </div>
            <div class="body">
                <asp:Image runat="server" ID="PostImage" CssClass="post-hero-image" />
                <asp:Literal runat="server" ID="PostText" />
                <div class="clear">
                </div>
            </div>
        </div>
    </ItemTemplate>
</asp:Repeater>
```

#### Subtext.Web\\Skins\\{YourSkin}\\style.css

Naturally I gave the PostImage a CSS Class so I could style it. I chose to float it right and give it max height and widths so it doesn’t take up the entire post. You can of course tweak this any way you like – this part is entirely in your skin. Put the image wherever and style it how you like.

```csharp
.post-hero-image
{
    float: right;
    margin: 0 0 6px 10px;
    max-height: 200px;
    max-width: 400px;
}
```

Summary
-------

All in all pretty small tweaks and I actually like how it turned out. I think images next to the posts make it a lot easier to scan topics as I’m scrolling down the page. If you agree and are using Subtext then hopefully this post will make it easy to add to your blog!

 

