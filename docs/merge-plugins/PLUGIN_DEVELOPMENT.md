# Plugin Development

- [Plugin Development](#plugin-development)
  - [Example: hello \<world\>](#example-hello-world)
    - [Example one: local file](#example-one-local-file)
    - [Example two: npm package](#example-two-npm-package)

The templatesync.json and templatesync.local.config files make use of a `"merge"` property where you can
customize the baseline behavior of ignore or overwrite from template.

This library provides a set of typescript types for you to create additional plugins.

At the core of it, you need to have a file or npm package that exposes the interface:

```typescript
export interface MergePlugin<PluginOptions> {
  /**
   * This method will be called when a file from the template and it's analog in the downstream repo
   * have some differences.  The plugin must perform the merge and return the appropriate file contents
   * as a string
   *
   * TODO: we may create a V2 plugin that could deal with large files and not pass around strings in memory,
   * but for now, this is the current implementation
   *
   * @param current - The downstream repo's current file contents
   * @param fromTemplateRepo - the current
   * @param context - an object defining the context around the file and the specific options
   */
  merge(
    current: string,
    fromTemplateRepo: string,
    context: MergeContext<PluginOptions>,
  ): Promise<string>;
  /**
   * Given an options object for the merge, this validates the options object and returns error messages if there is anything wrong.
   * @param options any json value that the user provided - must be validated against the expected options
   */
  validate(options: unknown): string[] | undefined;
}
```

## Example: hello \<world>

So let's say that we want to have a plugin that will take every file assigned to it, and just write hello {world} instead.
(Not much of a merge, but so it goes)

We will define and export an options object, validate function, and merge function

```typescript
// src/hello-plugin.ts
import { MergePlugin, MergeContext } from '@hanseltime/template-repo-sync'

export interface HelloOptions: {
  /** the name of the world we're greeting */
  world: string
}

export const validate: MergePlugin<HelloOptions>['validate'] = (options: unknown) => {
  const errors: string[] = [];
  // In our case, we have decided you HAVE to use an object
  if (typeof options !== 'object') {
    errors.push('must provide an object');
    return errors;
  }

  // make sure there aren't extra keys
  const { world, ...rest } = options;
  const unknownKeys = Object.keys(rest);
  if (unknownKeys.length > 0 ) {
    errors.push(`Unexpected options keys: ${unknownKeys.join(' ')}`);
  }

  if (!world) {
    errors.push(`Must provide a valid world value`);
  }

  return errors
}

export const merge:  MergePlugin<HelloOptions>['merge'] = async (current, fromTemplateRepo, options: HelloOptions) => {
  // Note, we don't use the current with this simple plugin, but we would use the first 2 args normally
  return `Hello ${options.world}`
}

```

With all of that set up, as long as we have the package available to the pacakge manager running our script, we can use it:

### Example one: local file

```json
{
  "merge": [
    {
      "glob": "**/*.txt",
      "plugin": "dist/hello-plugin.js",
      "options": {
        "world": "chad"
      }
    }
  ]
}
```

### Example two: npm package

Let's assume that you published this as an npm package to @myscope/hello-merge. Once you have install the pacakge to the project, you can
simply reference the package (assuming that it exposes the required functions as it's index file).

```json
{
  "merge": [
    {
      "glob": "**/*.txt",
      "plugin": "@myscope/hello-merge",
      "options": {
        "world": "chad"
      }
    }
  ]
}
```
