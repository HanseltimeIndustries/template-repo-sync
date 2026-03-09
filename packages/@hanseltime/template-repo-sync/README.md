# Template Sync

This npm package seeks to provide further granularity for people hoping to maintain a base template repo in github that
is either imported or used as a literal template repo.

In both of those cases, the downstream repos that have based themselves off of this template can quickly become out of sync for 2 reasons:

1. The template repo is actively being developed with new standards
2. The downstream repo has changes to support their use cases

If we were to consider that the template and its downstream repos are part of say, an organization's attempt at standardizing their
best practice development patterns, then we naturally want to have a way to allow each downstream implementer to adopt the newest
changes, while also having control over things that may be specifically changed due to their need to support something beyond the
orgnaization standard.

<!-- Created with Markdown All In One VsCode Entension, rerun to update -->

- [Template Sync](#template-sync)
- [How to use this](#how-to-use-this)
  - [Config file](#config-file)
    - [File format](#file-format)
    - [Example 1 - Using a custom plugin](#example-1---using-a-custom-plugin)
    - [Example 2 - Using a custom plugin for some paths](#example-2---using-a-custom-plugin-for-some-paths)
    - [Example 3 - First Rule precedence](#example-3---first-rule-precedence)
  - [From SHA/Tag directive](#from-shatag-directive)
  - [Programmatic API](#programmatic-api)

# How to use this

This repository publishes a github action that can be used for ease of use in github. It also provides itself as an npm package
for those who would like to implement the same calls in another CI/CD structure.

## Config file

There are two types of config files that you can create:

- `templatesync.config` in the template repo (this is for the template maintainer to specify how they would expect a roll out
  to update and for them to exclude anything that is more of an example than a standard (for instance, a hello world placeholder))

- `templatesync.local.config` in the repo that cloned the template. This is meant for the repo maintainers to have the ability to avoid
  or customize updates between the template repo in the event that they have deviated purposefully from it.

This library will always respect the overrides of the local template sync file if it exists but, as a compromise to rapidly developing
templates and their repos, will also provide a list of all files whose template sync behavior was either ignored or overridden by the local
file. In this way, teams should be able to track (with a little extra CI/CD wiring) or at the very least, explicitly acknowledge a deviation.

All config files have the ability to write custom merge plugins either in repo or published as packages for larger use.

Please see the [plugins](./docs/merge-plugins/) documentation for more information beyond the simple examples in this readme.

### File format

```typescript
export interface Config {
  /**
   * A set of micromatch globs that we are supposed to ignore
   */
  ignore: string[];
  /**
   * If there is no merge config, then we will always just overwrite the file for the diff
   */
  merge: [
    /**
     * The first merge rule that matches a file will be applied.
     */
    {
      /**
       * A string or list of strings that would be used by micromatch
       * against the file paths
       */
      glob: string | string[];
      /**
       * This could be a built-in merge plugin from this library
       *  i.e. "_json"
       *
       * It can also be an npm package or a path to a local file with
       * a merge plugin that matches the interface
       */
      plugin: string;
      /**
       * This is an object of options that correspond to the plugin
       * you specified
       */
      options: any;
    },
  ];
}
```

### Example 1 - Using a custom plugin

In this scenario, you have installed a package that exposes the correct plugin interface for handling .ini file contents in
your implementing repository and set up this templatesync.local config file. Because of this, we can be assured that .ini files
in the local repo will be merged using the plugin we specified.

```typescript
{
  merge: [
    {
      // For all .ini packages
      glob: "**/*.ini",
      // If you are running under package manager like yarn or npm,
      // you can provide a valid pacakge or .js fil from your package to run
      plugin: "my-installed-npm-package",
    },
  ];
}
```

### Example 2 - Using a custom plugin for some paths

Just like in example 1, we have installed a plugin that exposes the correct plugin interface. Now though,
instead of applying that plugin to all '.ini' files, we are saying that, for this particular set of .ini
files, only the ones in custom-configs/ will use this merge operator.

```typescript
{
  merge: [
    {
      // For all .ini packages
      glob: "custom-configs/**",
      // If you are running under package manager like yarn or npm,
      // you can provide a valid pacakge or .js fil from your package to run
      plugin: "my-installed-npm-package",
      options: {
        myPluginParam: "some parameter",
      },
    },
  ];
}
```

### Example 3 - First Rule precedence

If you have multiple merge rules that would match a file. The first and only the first rule that matches will be applied.

```typescript
{
  merge: [
    {
      // For all .ini packages
      glob: "custom-configs/**",
      // If you are running under package manager like yarn or npm,
      // you can provide a valid pacakge or .js fil from your package to run
      plugin: "my-installed-npm-package",
      options: {
        myPluginParam: "some parameter",
      },
    },
    {
      // For all other .ini packages
      glob: "**/*.ini",
      // If you are running under package manager like yarn or npm,
      // you can provide a valid pacakge or .js fil from your package to run
      plugin: "my-installed-npm-package",
    },
  ];
}
```

Note: if you need to do the equivalent of 2 merge plugins for a file, you can use a custom plugin
that would call both plugins!

## From SHA/Tag directive

One of the biggest pains of syncing templates is that you can end up seeing a change multiple times because your change has
purposefully desynchronized from the template. For instance, let's say that you need to support a newer framework than
the template you cloned from. You have added a PR to the template to upgrade, but the template maintainers are worried about
the effect of the change on all other template-based repos and are waiting. In the meantime, you still want to get any new
security patterns or boilerplate patterns for other tools.

To solve this, rudimentarily, we allow the local template sync config to provide a `afterRef` option. When provided, template sync
will only apply changes that have occurred after the ref (tag or sha) in question in the git based repo. This does not mean
that you will never see changes to the files from the last sync (because if someone changed something in that same file, all of its changes will be copied over),
but it does mean that you will only see the changes to files that are newer than the last time you looked at it.

As always, you can remove the SHA/Tag from your local config and this will trigger a full sync in the event that you made the wrong
assumption about merging templates correctly.

```typescript
{
    afterRef: 'git sha',
    merge: {
        ".ini": {
            // If you are running under pacakge manager like yarn or npm,
            // you can provide a valid pacakge or .js fil from your package to run
            plugin: 'my-installed-npm-package',
            rule: [
                {
                    glob: 'custom-configs/**',
                    options: {
                        myPluginParam: 'some parameter',
                    }
                }
            ]
        }
    }
}
```

## Programmatic API

The programmatic api for this package is centered around `templateSync`. The way the function is written, we try to
allow escape hatches for other styles of comparison in the form of "TemplateDriver" functions. As part of the current
implementation, all of these `drivers` represent git actions, but for the sake of expandability, may be set up to evaluate
things like helm chart renderings (at least that is the hope). If you write a driver, please consider contributing it back.

Please see [template-sync](./src/template-sync.ts) for the most up to date options.

TODO: we should update use case examples
