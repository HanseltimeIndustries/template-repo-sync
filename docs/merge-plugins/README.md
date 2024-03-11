# Merge Plugins

The templatesync.json and templatesync.local.config files make use of a `"merge"` property where you can
customize the baseline behavior of just ignoring or overwriting from the template.

# Example Use Case

One example of this behavior is around an npm package.json. If you were making a template for a particular
set of boilerplate for an npm package, you would probably provide an example package.json like:

```json
{
  "name": "<fill in your package name",
  "description": "<fill in your package description",
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "publish": "our-artifact-script"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "our-artifact-package": "^1.0.0"
  }
}
```

In this scenario, we expect the template user to declare their own `name` and `description`, and add their own
`scripts` and `devDependencies`. However, we are hoping to make sure that the publish method and and its
our-artifact-package are kept up-to-date on syncs. Because of this, we would make use of the default json merge
plugin that is built-in with this library:

```json
{
  "merge": {
    ".json": {
      // This uses the default plugin for json merges
      "rules": [
        {
          "glob": "package.json",
          "options": {
            "paths": [
              ["$.scripts.publish", "merge-template"], // Any changes to publish are so critical that we want them to sync
              ["$.devDependencies", "merge-template"] // Always ensure dev dependency versions for our scripts are updated
            ]
          }
        }
      ]
    }
  }
}
```

As a repo maintainer, we can be sure that when people sync from our repo in its current state, the publish script
and devDependency should be synced from package.json, without anything else!

## What if the repo extender is annoyed?

If the repo extender already made the decision to update the publish method for a good reason, they may find it
tedious to constantly get their publish script overwritten and then have to undo it. Due to the local
config file, they can specify their own merge configuration for the package.json.

```json
{
  "merge": {
    ".json": {
      // This uses the default plugin for json merges
      "rules": [
        {
          "glob": "package.json",
          "options": {
            "paths": [
              ["$.devDependencies", "merge-template"] // Always ensure dev dependency versions for our scripts are updated
            ]
          }
        }
      ]
    }
  }
}
```

This configuration will now override the template repo's merge and only allow devDependencies to be updated. We report
this override as part of the output of the sync call, and for things like our
[github action](https://github.com/HanseltimeIndustries/template-repo-sync-action), we format that output into the PR
that is opened up when performing a sync.
