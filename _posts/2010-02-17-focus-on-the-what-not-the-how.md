---
title: "Focus on the what, not the how"
disqus_identifier: http://www.matthidinger.com/archive/2010/02/17/focus-on-the-what-not-the-how.aspx
redirect_from: /archive/2010/02/17/focus-on-the-what-not-the-how.aspx/
tags: 
- c-sharp
- tips
---
I saw the following question asked earlier today -- the only context given was the code itself.

> Can anyone tell me what’s wrong with this
> Dim min As Integer = Integer.Parse(leavingTimeTextBox.Text.Substring(leavingTimeTextBox.Text.IndexOf(":") + 1, leavingTimeTextBox.Text.Length) -1 )?
> it shows me an exception index out of range exception: length and index must be within the range of the string, parameter name: length 
> so its five characters and on debug time : index is 2 so I'm starting from index 3 to length which is 5 -1 "4"

[<img src="/images/subtext-content/Focusonthewhatnotthehow_93EE/627226315_325aa7b527_thumb.jpg" title="627226315_325aa7b527" alt="627226315_325aa7b527" width="310" height="207" />](/images/subtext-content/Focusonthewhatnotthehow_93EE/627226315_325aa7b527.jpg) It was clear that he looking to parse some sort of pre-defined time format, but just to be sure I confirmed it with him. While I could have helped this person resolve the question he asked about (the IndexOutOfRangeException), instead I took a step back to focus on *what* he really wanted to achieve. His immediate  problem was that he was too focused on the details – *the how*. He knew what he wanted: the hour, and the minute of the occurrence in a timestamp, but using SubString and IndexOf was not going to be the most robust solution to this problem.

Two immediate solutions came to mind:

```csharp
var time1 = TimeSpan.Parse(leavingTimeTextBox.Text);
var time2 = DateTime.ParseExact(leaveTimeTextBox.Text, "HH:mm");
```

Without more context on his actual needs, the most useful solution is up to him, but at least this pointed him in the right direction.

The key take-away of this post is as follows:

> Your problem is not unique. Someone has had this problem, and solved it before. More often than not, that very solution can be found in the .NET base class libraries. If something is painful (and I consider most code combining Substring and IndexOf to be painful), take a step back and think about what you’re really trying to achieve, instead of the exact means of achieving it.

LINQ is another prime example of this simple concept: focus on the what.

### P.S.

I’ve paid closer attention to some of my favorite blogs (and magazine articles, and newspapers, etc) and noticed that they make good use of images to offset the text in their content. I don’t particularly care for this image or placement within this post, but it’s a work in progress!

 

