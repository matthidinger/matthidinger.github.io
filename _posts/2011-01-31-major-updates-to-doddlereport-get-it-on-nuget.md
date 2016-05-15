---
title: "Major updates to doddlereport, get it on nuget"
disqus_identifier: http://www.matthidinger.com/archive/2011/01/31/major-updates-to-doddlereport-get-it-on-nuget.aspx
redirect_from: /archive/2011/01/31/major-updates-to-doddlereport-get-it-on-nuget.aspx/
tags: 
- doddle
- open-source
- reporting
- nuget
header:
  teaser: subtext-content/www_matthidinger_com/Windows-Live-Writer/a172661a62bc_1218F/doddlexlsreport_thumb17_thumb.png
---
DoddleReport automatically generates tabular reports from any IEnumerable datasource. Out of the box it can render reports to Excel, PDF, HTML, and CSV – fully pluggable of course. I designed the project to provide reporting output over the LINQ queries we had already written for the application, but maybe you can find other uses for it.

 

### So what does it generate?

<table>
<colgroup>
<col width="50%" />
<col width="50%" />
</colgroup>
<tbody>
<tr class="odd">
<td><h3 id="excel-report">Excel Report</h3>
<ul>
<li>Automatic Sticky/Frozen Headers stay at the top when scrolling through the data</li>
<li><a href="http://doddle.matthidinger.com/Reporting/home/productreport.xls">See it live!</a></li>
</ul></td>
<td><h3 id="csvdelimited">CSV/Delimited</h3>
<ul>
<li>Use any kind of delimiter you want</li>
<li><a href="http://doddle.matthidinger.com/Reporting/home/productreport.txt">See it live!</a></li>
</ul></td>
</tr>
<tr class="even">
<td><p><a href="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/a172661a62bc_1218F/doddlexlsreport_thumb17_2.png"><img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/a172661a62bc_1218F/doddlexlsreport_thumb17_thumb.png" title="doddlexlsreport_thumb17" alt="doddlexlsreport_thumb17" width="300" height="211" /></a> <br />
<br />
</p></td>
<td><p><a href="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/a172661a62bc_1218F/doddleTxtReport_thumb_2.png"><img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/a172661a62bc_1218F/doddleTxtReport_thumb_thumb.png" title="doddleTxtReport_thumb" alt="doddleTxtReport_thumb" width="300" height="190" /></a></p></td>
</tr>
<tr class="odd">
<td><h3 id="pdf-report">PDF Report</h3>
<ul>
<li>Automatically repeat title, column headers, and page numbers on every page</li>
<li><a href="http://doddle.matthidinger.com/Reporting/home/productreport.pdf">See it live!</a></li>
</ul></td>
<td><h3 id="html-report">HTML Report</h3>
<ul>
<li><a href="http://doddle.matthidinger.com/Reporting/home/productreport.html">See it live!</a></li>
</ul></td>
</tr>
<tr class="even">
<td><p><a href="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/a172661a62bc_1218F/doddlepdfreport_thumb_2.png"><img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/a172661a62bc_1218F/doddlepdfreport_thumb_thumb.png" title="doddlepdfreport_thumb" alt="doddlepdfreport_thumb" width="300" height="295" /></a></p></td>
<td><p><a href="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/a172661a62bc_1218F/doddleHtmlReport_thumb_2.png"><img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/a172661a62bc_1218F/doddleHtmlReport_thumb_thumb.png" title="doddleHtmlReport_thumb" alt="doddleHtmlReport_thumb" width="300" height="236" /></a></p></td>
</tr>
</tbody>
</table>

### Basic Usage

```csharp
// Get the data for the report (any IEnumerable will work)
var query = ProductRepository.GetAll();
var totalProducts = query.Count;
var totalOrders = query.Sum(p => p.OrderCount);


// Create the report and turn our query into a ReportSource
var report = new Report(query.ToReportSource());


// Customize the Text Fields
report.TextFields.Title = "Products Report";
report.TextFields.SubTitle = "This is a sample Doddle Report";
report.TextFields.Footer = "Copyright 2011 © The Doddle Project";
```

 

### Get Started!

New to DoddleReport?

-   Look at the [**Building Your First Report**](http://doddlereport.codeplex.com/wikipage?title=Building%20your%20first%20report) page
-   Review the [documentation](http://doddlereport.codeplex.com/documentation)
-   Got NuGet? **Install-Package DoddleReport**

 



