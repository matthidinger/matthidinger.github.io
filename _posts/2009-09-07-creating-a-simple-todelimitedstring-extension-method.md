---
title: "Creating a simple ToDelimitedString extension method"
disqus_identifier: http://www.matthidinger.com/archive/2009/09/07/creating-a-simple-todelimitedstring-extension-method.aspx
redirect_from: /archive/2009/09/07/creating-a-simple-todelimitedstring-extension-method.aspx/
tags: 
- c-sharp
- linq
---
This was one of the first extension methods I wrote when C\# 3.0 arrived, since I just stumbled across it on an older project I figured I might as well post it, if for nothing else but future reference. One downside to be aware of if you choose to use this method, is that it will not project the results on a IQueryable provider like LINQ to SQL, so please be aware the conversion will be done on the client side.

### The Code

```csharp
public static class DelimitedStringExtensions
{
    public static string DefaultDelimiter = ", ";

    /// <summary>
    /// Convert a sequence of items to a delimited string. By default, ToString() will be called on each item in the sequence to formulate the result. The default delimiter of ', ' will be used
    /// </summary>
    public static string ToDelimitedString<T>(this IEnumerable<T> source)
    {
        return source.ToDelimitedString(x => x.ToString(), DefaultDelimiter);
    }

    /// <summary>
    /// Convert a sequence of items to a delimited string. By default, ToString() will be called on each item in the sequence to formulate the result
    /// </summary>
    /// <param name="delimiter">The delimiter to separate each item with</param>
    public static string ToDelimitedString<T>(this IEnumerable<T> source, string delimiter)
    {
        return source.ToDelimitedString(x => x.ToString(), delimiter);
    }

    /// <summary>
    /// Convert a sequence of items to a delimited string. The default delimiter of ', ' will be used
    /// </summary>
    /// <param name="selector">A lambda expression to select a string property of <typeparamref name="T"/></param>
    public static string ToDelimitedString<T>(this IEnumerable<T> source, Func<T, string> selector)
    {
        return source.ToDelimitedString(selector, DefaultDelimiter);
    }

    /// <summary>
    /// Convert a sequence of items to a delimited string.
    /// </summary>
    /// <param name="selector">A lambda expression to select a string property of <typeparamref name="T"/></param>
    /// <param name="delimiter">The delimiter to separate each item with</param>
    public static string ToDelimitedString<T>(this IEnumerable<T> source, Func<T, string> selector, string delimiter)
    {
        if (source == null)
            return string.Empty;

        if(selector == null)
            throw new ArgumentNullException("selector", "Must provide a valid property selector");

        if (string.IsNullOrEmpty(delimiter))
            delimiter = DefaultDelimiter;

        return string.Join(delimiter, source.Select(selector).ToArray());
    }
}
```

### Usage

Example using an array of ints

```csharp
int[] ints = { 1, 4, 5, 7 };

// Returns "1, 4, 5, 7"
string result = ints.ToDelimitedString();
```

Example using a List

```csharp
var products = new List<Product>
               {
                   new Product { ProductName = "Chai" },
                   new Product { ProductName = "Chang" },
                   new Product { ProductName = "Tofu" },
               };

// Returns "Chai, Chang, Tofu"
string result1 = products.ToDelimitedString(p => p.ProductName);


// Returns "Chai;Chang;Tofu"
string result2 = products.ToDelimitedString(p => p.ProductName, ";");
```

Example using a DataTable

```csharp
// Returns "Chai, Chang, Tofu"
string result = table.AsEnumerable().ToDelimitedString(row => (string)row["ProductName"]);
```

 

