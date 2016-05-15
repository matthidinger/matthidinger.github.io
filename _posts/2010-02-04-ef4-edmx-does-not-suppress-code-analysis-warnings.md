---
title: "EF4 EDMX does not suppress Code Analysis warnings"
disqus_identifier: http://www.matthidinger.com/archive/2010/02/04/ef4-edmx-does-not-suppress-code-analysis-warnings.aspx
redirect_from: /archive/2010/02/04/ef4-edmx-does-not-suppress-code-analysis-warnings.aspx/
tags: 
- entity-framework
- ef4
- rant
- code-analysis
header:
  teaser: subtext-content/EF4EDMXdoesnotsuppressCodeAnalysiswarnin_F735/CropperCapture3_thumb.png
---
### Update

I have [published the instructions and provided a template](http://www.matthidinger.com/archive/2010/02/09/customizing-the-entity-framework-t4-template-suppressing-code-analysis.aspx) that can be used to properly suppress code analysis.

 

Starting a new project opens the doors for some great things. One of those things for me, was adherence to code analysis from the get-go. Visual Studio 2010 in particular has great [Code Analysis Rule Set support](http://blogs.msdn.com/habibh/archive/2009/08/12/create-your-own-code-analysis-rule-set-using-visual-studio-team-system-2010.aspx) allowing teams to carefully dictate which rules they wish to apply and suppress.

Unfortunately, it wasn’t long before the decision to use Entity Framework 4 put a nice little wrench in my code analysis plan. (As an aside, I will blog more about my decision to use EF4 at a later date -- but long story short, it had to do with the large legacy database that we would be working with).

Shortly after loading the existing database into the EDMX and compiling, I was greeted by nearly 1300 code analysis warnings, ranging from naming of properties to “members should be marked read-only”, etc, etc, etc. I assumed that surely this was either an oversight in the beta that would be corrected before release -- unfortunately, my hopes were not realized.

[Microsoft Connect response to the issue:](http://connect.microsoft.com/VisualStudio/feedback/ViewFeedback.aspx?FeedbackID=434118 "http://connect.microsoft.com/VisualStudio/feedback/ViewFeedback.aspx?FeedbackID=434118") (emphasis mine)

> The generated code can not follow all the fxcop guidelines because of other requirements( mainly around Serialization). The **guidance here is to put GeneratedCode attribute on the members of the generated code so that FXCop does not flag these errors.** In .Net 4.0( which is our next release and Beta 1 of which is available now), we moved to use T4 templates for code generation. So it will be easier to modify the templates that we ship so that these attributes are produced in the generated code. **The reason we did not add these attributes in the templates we ship is because we did not want to clutter the templates.**

Really? Clutter the templates? I normally try to give teams the benefit of the doubt regarding decisions they make, given that I naturally don’t have all the intell that went into the decision, but I simply cannot defend this one. What is especially upsetting to me is that the EF4 team has made great strides in making their designs and development open and transparent, specifically in taking community feedback to heart. This decision surely adds more fuel to the fire on why some members of the community suggest EF should be avoided by quality teams.

Needless to say, I am pretty disappointed with this decision.

In the next few days I plan on [publishing a workaround using their T4 templates](http://www.matthidinger.com/archive/2010/02/09/customizing-the-entity-framework-t4-template-suppressing-code-analysis.aspx). I will provide the template and detailed instructions on how to take advantage of it if you plan on using EF4 anytime soon.

![](/images/subtext-content/EF4EDMXdoesnotsuppressCodeAnalysiswarnin_F735/CropperCapture3_thumb.png)


 

