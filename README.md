# grunt-reference

Grunt module that scrapes webpages for citations, aggregates them, and can
[produce an output][].

The code here is not intended for public and general use, as it fixes a
specific task.  I happened to write this code and thought it was pretty neat,
so I released it.  If you happen to come across something that makes you say,
"wow this is limiting" or "wow, I have to set up my DOM in a very particular
way," raise an issue or fork me!

This actually holds two tasks, `reference` and `renderReferencePage`.  Each
will be explained in turn.

# reference

Given a list of HTML pages, `reference` will parse out citations, make a
request to third party datasources, and then render a given template to be
inserted into the DOM.

## Options

- **referenceContainerId**: The id of the DOM element that will have the output
  of the citations for that page.
- **elementTemplateId**: The id of the underscore template in the DOM that,
  when rendered, will be placed after each citation in the page.
- **referenceTemplateId**: The id of the underscore template in the DOM that,
  when rendered, will be placed inside the `referenceContainer`

The list of HTML pages that are given to this task are parsed for `cite`
elements or any element that has a cite attribute. The text within the element
or attribute is then separated into three categories: websites, periodicals,
and books. 

The url for a website is used as citation object.

For a periodical the citation must be a DOI (Digital Object Identifier).

For a book the citation must be an ISBN (10 or 13)

After gathering the citations, the code will detect any [Ibid.][]

## Examples

The following examples show DOM snippets that are considered valid citations.

```html
<!-- ISBN-13 or ISBN-10 -->
<blockquote><cite>9781935182474</cite></blockquote>

<!-- DOI -->
<blockquote><cite>10.1145/356635.356640</cite></blockquote>

<!-- Website -->
<blockquote><cite>www.google.com</cite></blockquote>
```

# renderReferencePage

If given a HTML page, `renderReferencePage` will aggregate the citations, invoke
the given underscore template, and insert the result back into the DOM. A list
of files can be given, but the intended use is for a single file.

## Options

- **templateId**: The id of the underscore template in the DOM that renders the
  aggregated citations.
- **containerSelector**: jQuery selector that identifies the DOM element that 
  will have the aggregated template appended to it.

[produce an output]: http://www.nbsoftsolutions.com/blog/reference-track-sheet
[Ibid.]: http://en.wikipedia.org/wiki/Ibid.
