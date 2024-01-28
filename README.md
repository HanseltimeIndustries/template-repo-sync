# Template Sync Action

This npm package seeks to provide further granularity for people hoping to maintain a base template repo in github that
is either imported or used as a literal template repo.

In both of those cases, the downstream repos that have based themselves off of this template can quickly become out of sync
2 reasons: 

1. The template repo is actively being developed with new standards
2. The downstream repo has changes to support their use cases

If we were to consider that the template and its downstream repos are part of say, an organization's attempt at standardizing their
best practice development patterns, then we naturally want to have a way to allow each downstream implementer to adopt the newest
changes, while also having control over things that may be specifically changed due to their need to support something beyond the
orgnaization standard.

# How to use this

This repository publishes a github action that can be used for ease of use in github.  It also provides itself as an npm package
for those who would like to implement that same calls in another CI/CD structure.

## Config file

There are two types of config files that you can create: 

* `templatesync.config` in the template repo repo (this is for the template maintainer to specify how they would expect a roll out
    to update and for them to exclude anything that is more of an example than a standard (for instance, a hellow world placeholder))

*  `templatesync.local.config` in the repo that cloned the template.  This is meant for the repo maintainers to have the ability to avoid
    or customize updates between the template repo in the event that they have deviated purposefully from it.

This library will always respect the overrides of the local template sync file if it exists but, as a compromise to rapidly developing
templates and their repos, will also provide a list of all files whose template sync behavior was either ignored or overridden by the local
file.  In this way, teams should be able to track (with a little extra CI/CD wiring) or at the very least, explicitly acknowledge a deviation.

### File format

```typescript
export interface Config {
    /**
     * A set of micromatch globs that we are supposed to ignore
     */
    ignore: string[],
    /**
     * If there is no merge config, then we will always just overwrite the file for the diff
     */
    merge: {
        /**
         * .json file merge overrides.  Keep in mind, 
         */
        ".json": {
            // You can add a merge plugin for extensions that we don't natively support
            mergePlugin: string
            /**
             * A list of file globs for json files that can have custom rules applied
             * 
             * The first matching glob will be applied so make sure to put your defaults last
             */
            [fileGlobs: string]: JsonFileMerge
        }[],
    }
}
```

### Example 1

```typescript
{

    merge: {
        ".ini": {
            // If you are in a npm project, you can provide a valid pacakge or .js file to run
            driver: 'my-installed-npm-package',
        }
    }
}

```





