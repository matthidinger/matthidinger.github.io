---
title: "Transform your LINQ queries into Excel/PDF reports with DoddleReport 1.2"
disqus_identifier: http://www.matthidinger.com/archive/2011/12/07/Transform-your-LINQ-queries-into-ExcelPDF-reports-with-DoddleReport-1.aspx
redirect_from: /archive/2011/12/07/Transform-your-LINQ-queries-into-ExcelPDF-reports-with-DoddleReport-1.aspx/
tags: 
- doddle
- open-source
- reporting
- nuget
header:
  teaser: http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204393
---
> DoddleReport generates tabular reports from any IEnumerable datasource. Out of the box it can render reports to Excel, PDF, HTML, and CSV – fully pluggable of course. I created the project to provide reporting output over the LINQ queries we had already written for an application, but maybe you can find other uses for it.

So what does it generate?
-------------------------

*The following samples are generated live in real-time (notice the data will change every time you open the report)*

<table>
<colgroup>
<col width="50%" />
<col width="50%" />
</colgroup>
<tbody>
<tr class="odd">
<td><h3 id="excel-report-openxml">Excel Report (OpenXML)</h3>
<ul>
<li>Creates a native Excel file using OpenXML</li>
<li>Requires the DoddleReport.OpenXml package</li>
<li><a href="http://doddle.matthidinger.com/Reporting/home/productreport.xlsx"><strong>See it live!</strong></a></li>
</ul></td>
<td><h3 id="excel-report-html">Excel Report (HTML)</h3>
<ul>
<li>Creates an Excel file using HTML (downside being an Excel security prompt when opening the report)</li>
<li>Automatic Sticky/Frozen Headers stay at the top when scrolling through the data</li>
<li><strong><a href="http://doddle.matthidinger.com/Reporting/home/productreport.xls">See it live!</a></strong></li>
</ul></td>
</tr>
<tr class="even">
<td><p><a href="http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204392"><img src="http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204393" title="doddlexlsreport" alt="doddlexlsreport" width="300" height="211" /></a><br />
<br />
</p></td>
<td><p><a href="http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204392"><img src="http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204393" title="doddlexlsreport" alt="doddlexlsreport" width="300" height="211" /></a></p></td>
</tr>
<tr class="odd">
<td><h3 id="pdf-report-itextsharp">PDF Report (iTextSharp)</h3>
<ul>
<li>Automatically repeats title and column headers numbers on every page</li>
<li>Requires the DoddleReport.iTextSharp package</li>
<li><a href="http://doddle.matthidinger.com/Reporting/home/productreport.pdf"><strong>See it live!</strong></a></li>
</ul>
<h3 id="section"></h3></td>
<td><h3 id="pdf-report-abcpdf">PDF Report (ABCpdf)</h3>
<ul>
<li>Automatically repeats title, column headers, and page numbers on every page</li>
<li>Requires the DoddleReport.AbcPdf package</li>
<li><em>Requires an</em> <a href="http://www.websupergoo.com/products.htm#pd"><em>ABCpdf license</em></a></li>
<li><a href="http://doddle.matthidinger.com/Reporting/abcpdf/productreport.pdf"><strong>See it live!</strong></a></li>
</ul>
<h3 id="section-1"></h3></td>
</tr>
<tr class="even">
<td><p><a href="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/563d45072b2e_86C1/image_thumb%5B8%5D_2.png"><img src="/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/563d45072b2e_86C1/image_thumb%5B8%5D_thumb.png" title="image_thumb[8]" alt="image_thumb[8]" width="256" height="300" /></a></p></td>
<td><a href="http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204396"><img src="http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204397" title="doddlepdfreport" alt="doddlepdfreport" width="300" height="295" /></a></td>
</tr>
<tr class="odd">
<td><h3 id="csvdelimited">CSV/Delimited</h3>
<ul>
<li>Use any kind of delimiter you want</li>
<li><a href="http://doddle.matthidinger.com/Reporting/home/productreport.txt"><strong>See it live!</strong></a></li>
</ul></td>
<td><h3 id="html-report">HTML Report</h3>
<ul>
<li>Good old HTML report</li>
<li><a href="http://doddle.matthidinger.com/Reporting/home/productreport.html"><strong>See it live!</strong></a></li>
</ul>
<h3 id="section-2"></h3></td>
</tr>
<tr class="even">
<td><p><a href="http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204394"><img src="http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204395" title="doddleTxtReport" alt="doddleTxtReport" width="300" height="190" /></a></p></td>
<td><a href="http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204398"><img src="http://download.codeplex.com/download?ProjectName=doddlereport&amp;DownloadId=204399" title="doddleHtmlReport" alt="doddleHtmlReport" width="300" height="236" /></a></td>
</tr>
</tbody>
</table>

Get Started!
------------

### New to DoddleReport?

-   The project lives at CodePlex: [**http://doddlereport.codeplex.com/**](http://doddlereport.codeplex.com/ "http://doddlereport.codeplex.com/")
-   Look at the [**Building Your First Report**](http://doddlereport.codeplex.com/wikipage?title=Building%20your%20first%20report) page
-   If you’re using ASP.NET make sure to read the [**Web Reporting**](http://doddlereport.codeplex.com/wikipage?title=Web%20Reporting) section
-   Review the [**sample project**](http://doddlereport.codeplex.com/wikipage?title=Check%20out%20the%20sample%20project) in the solution
-   Check out the [**full documentation**](http://doddlereport.codeplex.com/documentation) **** for advanced customization and configuration

### Get it!

-   The preferred install method is NuGet
-   …but the compiled Binaries can be found under [**Downloads**](http://doddlereport.codeplex.com/releases/view/77983)
-   …or just get [**the latest source**](http://doddlereport.codeplex.com/SourceControl/list/changesets)

### NuGet Packages

DoddleReport has been split into multiple packages to support more users’ needs. See their Descriptions within NuGet for more on the differences.

-   **Install-Package DoddleReport**
-   **Install-Package DoddleReport.Web**
-   **Install-Package DoddleReport.iTextSharp**
-   **Install-Package DoddleReport.AbcPdf**
-   **Install-Package DoddleReport.OpenXml**
-   **Install-Package DoddleReport.Dynamic**

### ![](/images/subtext-content/www_matthidinger_com/Windows-Live-Writer/563d45072b2e_86C1/image_thumb.png)


New in v1.2
-----------

-   **NEW WRITER:** A new **OpenXML ExcelReportWriter** found in the DoddleReport.OpenXml package, courtesy of Louis-Philippe Perras
-   **NEW WRITER:** A new **iTextSharp PDF** writer can be found in the DoddleReport.iTextSharp package, courtesy of Louis-Philippe Perras (thanks again!)
-   **Breaking change**: The root namespace changed from **Doddle.Reporting** to just **DoddleReport**
-   **Breaking change**: The Default Orientation for reports is now **Portrait**
-   All Web references moved to separate project to allow for .NET Client Profile support for WinForms/WPF
-   Added “myReport.RenderHints.BooleansAsYesNo = true” to write **Yes**/**No** on the reports for boolean fields
-   Added custom FileName support for web reporting as requested in Discussions
-   Added MVC Areas support by calling areaRegistrationContext.MapReportingRoute();
-   Various Bug fixes and enhancements as reported in the Discussion forum and Issue Tracker


