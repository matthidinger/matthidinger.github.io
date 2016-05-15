---
layout: post
title: "An inheritance-aware ModelBinderProvider in MVC 3"
comments: true
disqus_identifier: http://www.matthidinger.com/archive/2011/08/16/An-inheritance-aware-ModelBinderProvider-in-MVC-3.aspx
redirect_from: /archive/2011/08/16/An-inheritance-aware-ModelBinderProvider-in-MVC-3.aspx/
tags: 
- aspnet-mvc
---
The default Model Binder in ASP.NET MVC works fine for most cases. Most of you have probably registered custom binders with it plenty of times.

The issue is that that it’s limited to binding the **exact type** you add to its dictionary. The ILoadProvider registered above will invoke my LoadProviderModelBinder **as long as the controller action parameter is of type ILoadProvider**. But what if you have a type that derives from ILoadProvider and still want your custom binding to occur?

Thankfully this is very simple in ASP.NET MVC 3. It comes with a new extensibility point, **IModelBinderProvider**, and works just like the other providers.

### InheritanceAwareModelBinderProvider

With this interface, we are able to create a very simple InheritanceAwareModelBinderProvider**.**

### Usage

Register the Model Binder Provider just as you normally would register Model Binders. For example, in Global.asax

Given the example above, if I’m binding to a type that that **inherits from ILoadProvider** my LoadProviderModelBinder will still handle the binding.

 

