import {
  MergeContext,
  JsonFileMergeOptions,
  JsonPathOverrides,
} from "../types";
import lodashMerge from "lodash.merge";
import locashCloneDeep from "lodash.clonedeep";
import jp, { PathComponent } from "jsonpath";
import { inferJSONIndent } from "../formatting/infer-json-indent";

function stringOptionError(value: string) {
  if (
    value === "overwrite" ||
    value === "merge-template" ||
    value === "merge-current"
  ) {
    return;
  }
  return `${value} must be one of type overwrite, merge-template, or merge-current`;
}

export function validate(options: unknown) {
  const errors: string[] = [];

  // check for flat options
  if (typeof options === "string") {
    const errMsg = stringOptionError(options);
    if (errMsg) {
      errors.push(errMsg);
    }
    return errors;
  } else {
    if (typeof options !== "object") {
      errors.push(`Options must be an object and not ${typeof options}`);
      return errors;
    }

    if (Array.isArray(options)) {
      errors.push(`Options must be an object and not Array`);
      return errors;
    }

    if (options === null) {
      errors.push("Options cannot be null");
      return errors;
    }
  }

  const optionsCast = options as JsonPathOverrides;
  const optionKeys = Object.keys(
    optionsCast,
  ) as unknown as (keyof JsonPathOverrides)[];
  optionKeys.forEach((k) => {
    if (k === "paths") {
      optionsCast.paths.forEach((pathObj) => {
        const [jsonPath, options] = pathObj;
        if (jsonPath.startsWith("$.")) {
          try {
            jp.parse(jsonPath);
          } catch (err) {
            errors.push(`Invalid jsonpath key: ${err}`);
            return;
          }
          const errMsg = stringOptionError(options);
          if (errMsg) {
            errors.push(`jsonpath ${jsonPath}: ${errMsg}`);
          }
        } else {
          errors.push(`Unrecognized jsonpath syntax: ${jsonPath}`);
        }
      });
    } else {
      if (k === "ignoreNewProperties" || k === "missingIsDelete") {
        return;
      }
      errors.push(`Unrecognized key: ${k}`);
    }
  });
  return errors;
}

export async function merge(
  current: string,
  fromTemplateRepo: string,
  context: MergeContext<JsonFileMergeOptions>,
): Promise<string> {
  if (context.mergeArguments === "overwrite") {
    return fromTemplateRepo;
  }

  const currentJson = JSON.parse(current);
  const fromTemplateJson = JSON.parse(fromTemplateRepo);

  if (context.mergeArguments === "merge-current") {
    // Performs Lodash Merge with current as the override
    return JSON.stringify(lodashMerge(fromTemplateJson, currentJson), null, 4);
  }

  if (context.mergeArguments === "merge-template") {
    // Performs Lodash Merge with current as the override
    return JSON.stringify(lodashMerge(currentJson, fromTemplateJson), null, 4);
  }

  const { missingIsDelete, ignoreNewProperties, paths } =
    context.mergeArguments as JsonPathOverrides;

  const returnJson = locashCloneDeep(currentJson);
  paths.forEach((p) => {
    const [jPath, overrideType] = p;

    const fromTemplatePaths: Map<string, PathComponent[]> = new Map();
    if (overrideType === "merge-template") {
      // We want to make sure there aren't extra paths from the template that didn't get added
      jp.nodes(fromTemplateJson, jPath).forEach((n) => {
        fromTemplatePaths.set(jp.stringify(n.path), n.path);
      });
    }
    jp.nodes(currentJson, jPath).forEach(({ path, value }) => {
      // This solves for wildcard operators
      const fullPath = jp.stringify(path);
      // track the paths in the template we've walked
      fromTemplatePaths.delete(fullPath);
      jp.apply(returnJson, fullPath, () => {
        const templateValue = jp.value(fromTemplateJson, fullPath);
        if (overrideType === "merge-template") {
          if (templateValue === undefined) {
            if (missingIsDelete) {
              return templateValue;
            }
          } else {
            return applyValueMerge(value, templateValue);
          }
        } else if (overrideType === "merge-current") {
          return applyValueMerge(templateValue, value);
        } else if (overrideType === "overwrite") {
          if (templateValue !== undefined || missingIsDelete) {
            return templateValue;
          }
        } else {
          throw new Error(`Unexpected JsonPath merge value ${overrideType}`);
        }
        return value;
      });
    });

    if (!ignoreNewProperties) {
      for (const fromTemplatePath of fromTemplatePaths.values()) {
        applyPerPath(fromTemplatePath, returnJson, fromTemplateJson);
      }
    }
  });

  if (!ignoreNewProperties) {
    Object.keys(fromTemplateJson).forEach((key) => {
      if (!returnJson[key]) {
        returnJson[key] = fromTemplateJson[key];
      }
    });
  }

  return JSON.stringify(returnJson, null, inferJSONIndent(current));
}

/**
 * A merge from a template to template perspective is either melding objects
 * or completely overwriting primitive types
 */
function applyValueMerge(base: unknown, toMerge: unknown) {
  if (typeof base === "object" && typeof toMerge === "object") {
    return lodashMerge(base, toMerge);
  } else {
    return toMerge;
  }
}

/**
 * Given a nodePath on the "map" tree, this will go to the first missing element
 * and copy that node onto the object
 *
 * @param nodePath
 * @param onto
 * @param map
 * @param forIdx
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPerPath(
  nodePath: jp.PathComponent[],
  onto: any,
  map: any,
  forIdx = 0,
) {
  if (nodePath[forIdx] === "$") {
    applyPerPath(nodePath, onto, map, forIdx + 1);
    return;
  }

  const selector = nodePath[forIdx];
  if (onto[selector]) {
    applyPerPath(nodePath, onto[selector], map[selector], forIdx + 1);
    return;
  }

  onto[selector] = map[selector];
}
