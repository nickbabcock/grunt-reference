# Reference.js

Grunt module that scrapes webpages for citations, aggregates them, and can
[produce an output][].

The code here is not intended for public and general use, as it fixes a
specific task.  I happened to write this code and thought it was pretty neat,
so I released it.  If you happen to come across something that makes you say,
"wow this is limiting" or "wow, I have to set up my DOM in a very particular
way," raise an issue or fork me!

## Options

- **referenceContainer**: The id of the DOM element that will have the output
  of the citations for that page.
- **elementTemplateId**: The id of the underscore template that, when rendered,
  will be placed after each citation in the page.
- **referenceTemplateId**: The id of the underscore template that, when
  rendered, will be placed inside the `referenceContainer`

The list of HTML pages that are given to this task are parsed for `cite`
elements or any element that has a cite attribute. The text within the element
or attribute is then separated into three categories: websites, periodicals,
and books. 

The url for a website is used as citation object.

For a periodical the citation must be a DOI (Digital Object Identifier).

For a book the citation must be an ISBN (10 or 13)

After gathering the citations, the code will detect any [Ibid.][]

[produce an output]: http://www.nbsoftsolutions.com/blog/reference-track-sheet
[Ibid.]: http://en.wikipedia.org/wiki/Ibid.
