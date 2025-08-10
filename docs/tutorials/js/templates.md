# Starting out with templates

Using [Handlebars](http://handlebarsjs.com/) and [metalsmith-layouts](https://github.com/superwolff/metalsmith-layouts).

This tutorial follows on from the [Introduction to Metalsmith JavaScript Interface](./introduction.md).

Lets install our first Metalsmith plugin ([metalsmith-layouts](https://github.com/superwolff/metalsmith-layouts)) and out templating engine - [Handlebars](http://handlebarsjs.com/):
```
npm install --save handlebars metalsmith-layouts jstransformer-handlebars
```
This will install them both.

Now, we shall add a `templates` directory where we will keep all our templates. So we have something like this:
```
.
├── source
│   └── index.html
├── templates
│   └── main.hbs
└── build.js
```


`source/index.html` - the `layout` in the Frontmatter tells the layouts plugin which template to use.
```
---
title: Story time
layout: main.hbs
---

Once upon a time there was a...
```


`build.js` now includes our layouts, _note_: `handlebars` isn't _required_, it's handled by `metalsmith-layouts`.
```js
var Metalsmith = require('metalsmith');
var layouts = require('metalsmith-layouts');

Metalsmith(__dirname)
    .source('./source')
    .destination('./build')
    .use(layouts({
        engine: 'handlebars',
        directory: 'templates'
    }))
    .build(function (err) {
        // For error handling
        if (err) {
            throw err;
        }
    });
```


`templates/main.hbs`
```
<h1>{{title}}</h1>

<p>
    {{contents}}
</p>
```


Run the build:

```node build.js```

The contents of the `index.html` in the `build` directory now contains:
```
<h1>Story time</h1>

<p>
    
Once upon a time there was a...
</p>
```

The `{{title}}` within the `h1` tags has been replaced with 'Story time' which was defined in the Frontmatter.

`{{contents}}` is replaced by the body of the file. This variable is always holds the contents of the file even when you don't have any Frontmatter.

Try adding other Frontmatter and changing the template to see what happens.

# Using Markdown - for your sanity

[Markdown](https://en.wikipedia.org/wiki/Markdown) makes writing content much easier.

Lets install the `[metalsmith-markdown](https://github.com/segmentio/metalsmith-markdown)` plugin

```npm install --save metalsmith-markdown```

Add it to `build.js`, note that `.use(markdown())` is before the `layouts` plugin. This is so the Markdown is processed before the templates are parsed. **Order *is* important** - think of it like a pipeline where each plugin potentially makes transformations to the files between `source` and the `destination`.
```js
var Metalsmith = require('metalsmith');
var markdown = require('metalsmith-markdown');
var layouts = require('metalsmith-layouts');

Metalsmith(__dirname)
    .source('./source')
    .destination('./build')
    .use(markdown())
    .use(layouts({
        engine: 'handlebars',
        directory: 'templates'
    }))
    .build(function (err) {
        // For error handling
        if (err) {
            throw err;
        }
    });
```


Rename `index.html` to `index.md` and add some Markdown:
```
---
layout: main.hbs
title: Story time
---

*Once* upon a time there was a list of names:
- Ada **Lovelace**
- Charles **Babbage**
```


Now after running the build we get `build/index.html`. *Note*: the extension is `.html` and not `.md` - the Markdown plugin renames it to `.html`.
```
<h1>Story time</h1>

<p>
    <p><em>Once</em> upon a time there was a list of names:</p>
<ul>
<li>Ada <strong>Lovelace</strong></li>
<li>Charles <strong>Babbage</strong></li>
</ul>

</p>
```

The output of the file looks a lot more like HTML now.  Technically, we should amend the `main.hbs` to wrap `contents` in three braces (e.g. `{{{contents}}}`) as the Markdown plugin is converting it to HTML.  Read about [HTML escaping](http://handlebarsjs.com/#html-escaping) why we do this.

Try adding more Markdown to see what the HTML looks like.

# Result
We've created templates and Markdown support for our static HTML build system.

# Collaborators and Sources
[Andrew Goodricke](http://andrewgoodricke.com/)
