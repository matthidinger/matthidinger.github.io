---
title: "Styles up Top, Scripts on Bottom"
disqus_identifier: https://www.matthidinger.com/archive/2008/02/25/styles-up-top-scripts-on-bottom.aspx
redirect_from: /archive/2008/02/25/styles-up-top-scripts-on-bottom.aspx/
tags: 
- javascript
- web-standards
- aspnet
- css
header:
  teaser: 
---
Today I just stumbled onto some interesting information regarding placements of script blocks and CSS links. According to some extensive testing performed at Yahoo!, they have published a list of [Best Practices for Speeding Up Your Web Site](https://developer.yahoo.com/performance/rules.html "https://developer.yahoo.com/performance/rules.html"). Many of these rules came as no surprise, for example:

> While researching performance at Yahoo!, we discovered that moving stylesheets to the document HEAD makes pages load faster. This is because putting stylesheets in the HEAD allows the page to render progressively.

However, one rule caught my attention:

> Rule 5 described how stylesheets near the bottom of the page prohibit progressive rendering, and how moving them to the document HEAD eliminates the problem. Scripts (external JavaScript files) pose a similar problem, but the solution is just the opposite: it's better to move scripts from the top to as low in the page as possible. One reason is to enable progressive rendering, but another is to achieve greater download parallelization.

So sure I thought, maybe it will provide better performance, but when creating internet-facing web sites I am a firm believer in standards and compliance. I admit I don't run my markup through an XHTML validator as much as I should, but I was always under the impression that for valid XHTML, &lt;script&gt; blocks and includes belong in the &lt;head&gt; element. Nay, according to the working [W3C XHTML Draft](https://www.w3.org/TR/2003/WD-xhtml2-20030506/mod-scripting.html#edef_scripting_script):

> The [script](https://www.w3.org/mod-scripting.html#edef_scripting_script) element places a script within a document. This element may appear any number of times in the [head](https://www.w3.org/mod-structure.html#edef_structure_head) or [body](https://www.w3.org/mod-structure.html#edef_structure_body) of an XHTML document.



