# Everything's a plugin
As everything is a plugin in Metalsmith, it's really useful to understand them a bit.  Luckily, they are extremely simple and once you know the basics you can dig into published plugins and understand how they work too.

The following code is a valid plugin, however it does absolutely.

<kbd>modules/my_plugin.js</kbd>
```javascript
var my_plugin = function (options) {
    return function (files, metalsmith, done) {
        // Does nothing and calls done() to tell Metalsmith it has finished
        done();      
    };
};

// Expose the plugin
module.exports = my_plugin;
```

Metalsmith expects a reference to a function that it can pass three parameters to:
1. **files** &mdash; An object containing file paths as keys and metadata, file contents, etc of the file as objects within.  We'll see how they are structured a bit later.
2. **metalsmith** &mdash; A reference to the Metalsmith instance. Most of the time we don't need this however there are situations where it's useful.
3. **done** &mdash; The callback to let Metalsmith know the plugin has completed its tasks.

# Using the plugin

We can use the plugin exactly like any other Metalsmith plugin, the only difference being that you've written it yourself.

<kbd>index.js</kbd>
```javascript
var Metalsmith = require('metalsmith');
var my_plugin = require('./modules/my_plugin');
 
Metalsmith(__dirname)
    .source('./src')
    .use(my_plugin({
        some: 'options'
      , to  : 'pass to the plugin'
    }))
    .destination('./build')
    .build(function (err) {
        // For error handling
        if (err) {
            throw err;
        }
    });
```

`source(path)` defaults to `./src` and

`destination(path)` defaults to `./build`.

&mdash; *I've included them to be explicit but technically they're not required.*

# Plugin variables and their uses

I have a file in the src directory with the following [YAML](https://en.wikipedia.org/wiki/YAML):

<kbd>src/first_file.md</kbd>
```yaml
---
title: Swimming with Penguins
date: 2015-07-17
tags:
    - fishing
    - cheese
    - pluto
nested:
    these: properties
    are: children
    of: nested
---
```

Below is an annotated **Metalsmith plugin template** to explain some uses of a plugin and what's available to you.

<kbd>modules/my_plugin.js</kbd>
```javascript
// Include debug to help with debugging.
var debug = require('debug')('metalsmith-name-of-my-plugin');


var my_plugin = function (options) {
    
    // Initialise plugin with options.
    // The plugin could need an instance of a library to process the data.

    return function (files, metalsmith, done) {

        // Metalsmith metadata usage:
        var metadata = metalsmith.metadata();

        // Loop through files
        Object.keys(files).forEach(function(file){
            debug('checking file: %s', file);
            var file_data = files[file];
        }

        // Errors should be reported if necessary
        if (has_issue) {
            done(new Error('Explain the issue'));
        }

        // Call done() to tell Metalsmith it has finished.
        // This allows us to work asynchronously and call it when we are done.
        done();      
    };
};

// Expose the plugin
module.exports = my_plugin;
```

If you're not familiar with the [`debug` module](https://github.com/visionmedia/debug), it's worth looking into. 

## Options
In our instance of the plugin, this is contents of `options`:
```json
{
    some: 'options',
    to: 'pass to the plugin'
}
```

Using `options` is a great way to enable configuration of your plugin.  If you don't you could just pass a reference to the function we return in our plugin, however most plugins work in this way so it's better to continue with the convention even if you don't pass any options to your plugin.

During the initialisation you can check for required parameters and throw an error if they're not there.

## Files
```json
{
    'first_file.md': {
        title: 'Swimming with Penguins',
        date: new Date('2015-07-17'),
        tags: [
            'fishing',
            'cheese',
            'pluto'
        ],
        nested: {
            these: 'properties',
            are: 'children',
            of: 'nested'
        },
        contents: <Buffer >,
        mode: '0664',
        stats: {
            <Information about the file>
        }
    },
    'path_to/other_file.ext': {
        contents: <Buffer >,
        mode: '0664',
        stats: {
            <Information about the file>
        }
    }

}
```

`files` is an object listing all the files in the source directory, treat this like it's the current state of the files.  The object key is the filename path (e.g. `first_file.md`) which is an object with properties of the file.
- `contents` &mdash; Contents of the file excluding the YAML.
- `mode` &mdash; The permissions the file has.
- `stats` &mdash; More information about the file, creation time, size, etc.

These default properties are always present, any YAML at the top of the files will be also present itself in this object as you can see from the contents of `first_file.md`.

If you wanted to add a default property for all or some of your files, that could be done by looping through the files very easily.

### Adding, removing and renaming files
Any changes to the keys of the `files` object will be reflected in the build directory.

- **Add new files** &mdash; Just create a new key in the object
- **Remove files** &mdash; Delete the key
- **Renaming or moving files** &mdash; Create a new key with the original contents and remove the original key.

Here's an example of moving all files to a *new* directory

<kbd>modules/filename_manipulations.js</kbd>
```javascript
var my_plugin = function (options) {
    return function (files, metalsmith, done) {

        // Loop through files
        Object.keys(files).forEach(function(file){
            // Create a new file with the contents of the original
            files['new/' + file] = files[file];
            // Remove the original file
            delete files[file];
        });

        done();
    };
};

// Expose the plugin
module.exports = my_plugin;
```


## Metalsmith metadata

Metalsmith metadata is really useful for if you need to provide data about your files, their structure or something else to other plugins or your templates.

It's best not to rely on metadata in your plugins if possible. Each plugin should be able to accept the state of the files, manipulate them and leave them in a state where other plugins down the chain can deal with them without any issues.

Providing navigation menu structure to all pages is a great application of metadata.

## Error Handling

It's important to not `throw` errors but to call the callback (`done()`) with the error.  This way Metalsmith can handle the errors properly.

```js
done(new Error('The message you want to provide'));
```

When generating errors, try to make them as descriptive as possible to help diagnose why the error is occuring.

# Collaborators and Sources
[Andrew Goodricke - Metalsmith Plugins](http://andrewgoodricke.com/blog/metalsmith-plugins/)
