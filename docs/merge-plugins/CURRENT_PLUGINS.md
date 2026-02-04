# Current Merge Plugins

This document lists all merge plugins that are provided as defaults for certain file extensions.
These should be found in the [plugins folder](src/plugins)

- [Current Merge Plugins](#current-merge-plugins)
  - [Json Merge Plugin](#json-merge-plugin)
  - [Configuration Options:](#configuration-options)
    - [Simple merge spec](#simple-merge-spec)
    - [JsonPath config](#jsonpath-config)
      - [Example](#example)
    - [About Comments](#about-comments)

<!-- Created with Markdown All In One VsCode Extension -->

## Json Merge Plugin

The json merge plugin allows you to configure jsonpath based merges on any .json file.

Plugin Field Name: `_json`

## Configuration Options:

### Simple merge spec

At it's simplest, you can take advantage of lodash merge behavior by just specifying one of:

- overwrite - the template completely overwrites the file
- merge-template - keys are merged together with the template overwriting any matching keys on local file
- merge-current - keys are merged together with the local file keeping any keys that match in the template

Example config:

```json
{
  "merge": {
    ".json": {
      "rules": [
        {
          "glob": "metadata.json",
          "options": "merge-template"
        },
        {
          "glob": "template-lock.json",
          "options": "overwrite"
        },
        {
          "glob": "package.json",
          "options": "merge-current"
        }
      ]
    }
  }
}
```

### JsonPath config

If you would like further control over what merges within a .json file, you can actually specify, via way of jsonpath operators,
the level of merge per field.

A few rules:

- Once you have provided jsonpath options, only the json path options (or new fields if the option is enabled) will be merged
- jsonpaths are run from first to last. This means you can layer merges.

```typescript
interface Options {
  /**
   * If set to true, this means we won't add new properties from the template
   */
  ignoreNewProperties?: boolean;
  /**
   * If set to true, overwrite will apply undefined values as deleted for the jsonpaths
   * or for values that are supposed to be merged on top of other values
   */
  missingIsDelete?: boolean;
  /**
   * Note, if multiple json paths match a rule, we pick the first one in the list that matches
   */
  paths: /**
   * We only override jsonpaths.  Anything not specified is kept the same.
   */
  [jsonPath: `$.${string}`, options: BaseJsonMergeOptions][];
}
```

#### Example

```json
{
  "merge": {
    ".json": {
      "rules": [
        {
          "glob": "metadata.json",
          "options": {
            "ignoreNewProperties": false,
            "missingIsDelete:": true,
            "paths": [
              ["$.path", "template-merge"] // if we delete path in the template, it will delete the path
            ]
          }
        },
        {
          "glob": "template-lock.json",
          "options": "overwrite"
        },
        {
          "glob": "package.json",
          "options": {
            "ignoreNewProperties": false,
            "paths": [
              ["$.scripts.*", "template-merge"],
              ["$.scripts.specific-script", "template-currrent"] // We end up keeping the current template
            ]
          }
        }
      ]
    }
  }
}
```

### About Comments

There are numerous json files that support comments now; tsconfig.json is a prime example of this. In order to support this,
this library makes use of comment-json for parsing and stringifying. This means that, minimally, you will not run into errors
when merging commented json files (and that you can comment on your templatesync config files).

One thing to note however, is that only include comments from the template if they are inside of an object that is being merged.
This is because this plugin has not yet defined a good configuration for merging comments. If you run into a pertinent need for this,
please feel free to open an issue and potentially contribute a fix in a PR.

Example of comment merging:

```json
// In template

{
  // I have a comment here
  "newField": 44,
  "overridingField": {
    // Comment in here
    "value": "v",
  }
}

// In the extending repo
{
  // My custom comment
  "newField": 88,
  "overridingField": 66
}

// After merging with template-merge
{
  // My custom comment
  "newField": 44,
  "overridingField": {
    // Comment in here
    "value": "v",
  }
}
```

From the above example, you can see that we specifically keep as many of the comments as possible from the extending repo
and only the comment that was fully nested inside new value that we were adding was kept.
