---
layout: post
title: "IE6 Underscore Hack"
comments: true
disqus_identifier: http://www.matthidinger.com/archive/2008/05/07/ie6-underscore-hack.aspx
redirect_from: /archive/2008/05/07/ie6-underscore-hack.aspx/
tags: 
- css
- web-standards
---
So as you can see I've been playing with ASP.NET MVC in my free time lately. But as it turns out I learned something totally unrelated to MVC while I was editing the default stylesheet that MVC Preview 2 ships with.

``` brush:
#mainContent
{
    padding: 30px 30px 15px 30px;
    background-color: #FFF;
    border-bottom: 3px groove #4b6f92;
    margin-bottom: 30px;
    _height: 1px; /* only IE6 applies CSS properties starting with an underscrore */
}
```

[](http://11011.net/software/vspaste)I can't believe I never knew about this. I have read 3 CSS books in the past few years and don't recall ever reading about this hack. So while it isn't the end-all solution to fixing CSS bugs in IE6, I think it should come in pretty handy in the future now that I know it exists.

I found this URL to [WellStyled](http://www.wellstyled.com/css-underscore-hack.html "http://www.wellstyled.com/css-underscore-hack.html") which describes the hack in more detail. Here are some cool usage examples of this hack:

``` brush:
#box 
{ 
    min-height: 300px; 
    height: auto; 
    _height: 300px; 
}
#menu 
{ 
    position: fixed; 
    _position: absolute; 
}
```

