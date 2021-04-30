---
title: "Rename namespaces intelligently with ReSharper"
disqus_identifier: https://www.matthidinger.com/archive/2009/12/03/rename-namespaces-intelligently-with-resharper.aspx
redirect_from: /archive/2009/12/03/rename-namespaces-intelligently-with-resharper.aspx/
tags: 
header:
  teaser: subtext-content/RenamenamespacesintelligentlywithReSharp_105C4/classview2_thumb.jpg
---
As is usually the case when I encounter a pain point while developing with Visual Studio, a quick google search reminds me that all along this problem has been solved for me. Today’s lesson is brought to you by the all-to-common namespace renaming. Earlier today I started cleaning up the file structure in the Solution Explorer, and up until now I would resort to a clumsy Solution Wide Find-Replace to fix up the namespaces after the files were moved into their more logical placement.

However, I should have realized that ReSharper would have handled this for me – and intelligently.

![](/images/subtext-content/RenamenamespacesintelligentlywithReSharp_105C4/classview2_thumb.jpg)


In my case, I wanted to do 2 things. First, remove .Core from the namespaces (I already updated the Project Property pane to set the default namespace to MyCompany.MyProject). Second, I wanted to move MyCompany.MyProject.Core.Parsing into the Importing namespace (since it’s actually a subcomponent of the Importing process). Both of these actions took a matter of seconds.

Logically enough, ReSharper has hooked into the much underappreciated Visual Studio Class View (Ctrl+Shift+C)

![](/images/subtext-content/RenamenamespacesintelligentlywithReSharp_105C4/classview_thumb.jpg)


![](/images/subtext-content/RenamenamespacesintelligentlywithReSharp_105C4/classview3_thumb.jpg)


Originally I thought I would have to visit each namespace to remove the “.Core” -- but ReSharper went ahead and preserved my hierarchy. By renaming the lower-level namespace, all higher-level namespaces were updated automatically. A small but very welcomed feature, especially when refactoring larger code-bases.

P.S. I also noticed that another way to accomplish the same thing, is to right-click on the namespace in any .cs file and select the Refactor menu from there. (Or Ctrl+R, R). Not really sure why I never tried that on a namespace before.

