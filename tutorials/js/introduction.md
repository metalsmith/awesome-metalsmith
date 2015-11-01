# Introduction to Metalsmith using the Javascript Interface

We shall start with the following file structure to get started:
```
.
├── source
│   └── index.html
└── build.js
```


`build.js`
```js
var Metalsmith = require('metalsmith');

Metalsmith(__dirname)
    .source('./source')
    .destination('./build')
    .build(function (err) {
        // For error handling
        if (err) {
            throw err;
        }
    });
```


`source/index.html`
```
---
title: Story time
---

Once upon a time there was a...
```


It's best to create the files on your system as you go through the tutorial so you can see it in action.

Before running this we need to download Metalsmith via [npm](https://www.npmjs.com/) else we'd recieve an error about not being able to find the module `metalsmith`.

If you're using Node.js version **`v0.12`** or below, it might be best to install version ^1.7.0 [or read the troubleshooting guide](https://github.com/segmentio/metalsmith#troubleshooting) for more information.
```npm install --save metalsmith@^1.7.0```

Otherwise install the latest version:
```npm install --save metalsmith```

After this has been installed you can run the build.

```node build.js```

This will have created a new directory called `build` as it is defined as the `destination('./build')`.  So the directory structure is now:
```
.
├── build
│   └── index.html
├── source
│   └── index.html
└── build.js
```

This is a straight copy of the files from `source` to the `destination`. Metalsmith reads the files from the `source` directory and runs them through plugins and puts the output in the `destination`. We have no plugins in use so we get exactly out exactly what we put in except the `frontmatter` has been removed.

# Frontmatter
The frontmatter in our example was was between the two sets of three hyphens (`---`). The frontmatter is defined in as [YAML](https://en.wikipedia.org/wiki/YAML) and is parsed so it is available to plugins and templates.

e.g. In our example, the following:
```
---
title: Story time
---
```
... will have been removed from the file but `title` will have been set to `'Story time'` and the *contents* of the `destination` file set to:
```

Once upon a time there was a...
```

A file doesn't need to have *frontmatter* but generally you will probably want to use it in content files, uses of *frontmatter* are explained in later tutorials.

Run through the example to see for yourself. Maybe add some other files, directories, images? See what happens to them.

# Result
We have started with the most basic usage of Metalsmith to demonstrate that the only modifications from the `source` to `destination` directories are to process and remove *frontmatter*.

# Collaborators and Sources
[Andrew Goodricke](http://andrewgoodricke.com/)
