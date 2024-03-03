/* eslint-disable @typescript-eslint/no-explicit-any */
import { JsonPathOverrides } from "../types";
import { merge, validate } from "./json-merge";

const testFileJson = {
  here: "here",
  another: 23,
  inner: {
    el1: "el1",
    arr1: ["a1", "a2"],
    nested: {
      final: "final",
      final2: "final2",
    },
  },
};

const templateFileJson = {
  here: "heretemplate",
  extra: "extra",
  inner: {
    arr1: ["b1", "b2"],
    extra2: "extra2",
  },
};

describe("merge", () => {
  it("performs overwrite when specified", async () => {
    const fromTemplateJson = {
      fullOverride: true,
    };
    expect(
      JSON.parse(
        await merge(
          JSON.stringify(testFileJson),
          JSON.stringify(fromTemplateJson),
          {
            relFilePath: "somepath",
            mergeArguments: "overwrite",
          },
        ),
      ),
    ).toEqual(fromTemplateJson);
  });
  it("performs lodash merge-template when specified", async () => {
    expect(
      JSON.parse(
        await merge(
          JSON.stringify(testFileJson),
          JSON.stringify(templateFileJson),
          {
            relFilePath: "somepath",
            mergeArguments: "merge-template",
          },
        ),
      ),
    ).toEqual({
      here: "heretemplate",
      extra: "extra",
      another: 23,
      inner: {
        el1: "el1",
        arr1: ["b1", "b2"],
        extra2: "extra2",
        nested: {
          final: "final",
          final2: "final2",
        },
      },
    });
  });
  it("performs lodash merge-current when specified", async () => {
    expect(
      JSON.parse(
        await merge(
          JSON.stringify(testFileJson),
          JSON.stringify(templateFileJson),
          {
            relFilePath: "somepath",
            mergeArguments: "merge-current",
          },
        ),
      ),
    ).toEqual({
      here: "here",
      extra: "extra",
      another: 23,
      inner: {
        el1: "el1",
        arr1: ["a1", "a2"],
        extra2: "extra2",
        nested: {
          final: "final",
          final2: "final2",
        },
      },
    });
  });
  it("performs pathjson merges with default non-path values", async () => {
    expect(
      JSON.parse(
        await merge(
          JSON.stringify(testFileJson),
          JSON.stringify(templateFileJson),
          {
            relFilePath: "somepath",
            mergeArguments: {
              paths: [
                ["$.here", "merge-template"],
                ["$.inner.arr1", "merge-template"],
                ["$.inner.el1", "overwrite"],
              ],
            },
          },
        ),
      ),
    ).toEqual({
      here: "heretemplate",
      // This is the extra here since we add missing
      extra: "extra",
      another: 23,
      inner: {
        // This will stay here
        el1: "el1",
        arr1: ["b1", "b2"],
        // extra2 doesn't show up since we didn't dictate it
        nested: {
          final: "final",
          final2: "final2",
        },
      },
    });
  });
  it("performs pathjson merges with missing deletions", async () => {
    expect(
      JSON.parse(
        await merge(
          JSON.stringify(testFileJson),
          JSON.stringify(templateFileJson),
          {
            relFilePath: "somepath",
            mergeArguments: {
              missingIsDelete: true,
              paths: [
                ["$.here", "merge-template"],
                ["$.inner.nested", "overwrite"],
              ],
            },
          },
        ),
      ),
    ).toEqual({
      here: "heretemplate",
      extra: "extra",
      another: 23,
      inner: {
        el1: "el1",
        arr1: ["a1", "a2"],
        // nested is gone because it was undefined
      },
    });
  });
  it("performs pathjson merges with ignore new", async () => {
    expect(
      JSON.parse(
        await merge(
          JSON.stringify(testFileJson),
          JSON.stringify(templateFileJson),
          {
            relFilePath: "somepath",
            mergeArguments: {
              ignoreNewProperties: true,
              paths: [
                ["$.here", "merge-template"],
                ["$.inner.arr1", "merge-template"],
              ],
            },
          },
        ),
      ),
    ).toEqual({
      here: "heretemplate",
      //  extra: 'extra', - not added
      another: 23,
      inner: {
        el1: "el1",
        arr1: ["b1", "b2"],
        nested: {
          final: "final",
          final2: "final2",
        },
      },
    });
  });
  it("performs pathjson merges with no missing delete", async () => {
    expect(
      JSON.parse(
        await merge(
          JSON.stringify(testFileJson),
          JSON.stringify(templateFileJson),
          {
            relFilePath: "somepath",
            mergeArguments: {
              paths: [
                ["$.here", "merge-template"],
                ["$.inner.nested", "merge-template"],
              ],
            },
          },
        ),
      ),
    ).toEqual({
      here: "heretemplate",
      extra: "extra",
      another: 23,
      inner: {
        el1: "el1",
        arr1: ["a1", "a2"],
        nested: {
          final: "final",
          final2: "final2",
        },
      },
    });
  });
  it("performs pathjson merges on multipath selection", async () => {
    const template = { ...templateFileJson };
    (template.inner as any).nested = {
      final: { something: 44 },
      newThing: "this",
    };
    expect(
      JSON.parse(
        await merge(JSON.stringify(testFileJson), JSON.stringify(template), {
          relFilePath: "somepath",
          mergeArguments: {
            paths: [
              ["$.here", "merge-template"],
              ["$.inner.nested.*", "merge-template"],
            ],
          },
        }),
      ),
    ).toEqual({
      here: "heretemplate",
      extra: "extra",
      another: 23,
      inner: {
        el1: "el1",
        arr1: ["a1", "a2"],
        nested: {
          final: { something: 44 },
          final2: "final2",
          newThing: "this",
        },
      },
    });
  });
  it("performs pathjson merges on stacked selections", async () => {
    const template = { ...templateFileJson };
    (template.inner as any).nested = {
      final: { something: 44 },
      newThing: "this",
    };
    expect(
      JSON.parse(
        await merge(JSON.stringify(testFileJson), JSON.stringify(template), {
          relFilePath: "somepath",
          mergeArguments: {
            paths: [
              ["$.here", "merge-template"],
              ["$.inner.nested.*", "merge-template"],
              ["$.inner.nested.final", "merge-current"],
            ],
          },
        }),
      ),
    ).toEqual({
      here: "heretemplate",
      extra: "extra",
      another: 23,
      inner: {
        el1: "el1",
        arr1: ["a1", "a2"],
        nested: {
          final: "final",
          final2: "final2",
          // We only added the newThing
          newThing: "this",
        },
      },
    });
  });
});

describe("validate", () => {
  it("passes correct flat mapped values", () => {
    expect(validate("merge-template")).toEqual([]);
  });
  it("passes correct options object", () => {
    expect(
      validate({
        ignoreNewProperties: true,
        missingIsDelete: false,
        paths: [
          ["$.something", "merge-current"],
          ["$.something[*].values", "merge-current"],
        ],
      } as JsonPathOverrides),
    ).toEqual([]);
  });
  it("returns an error if a flat map value is not correct", () => {
    expect(validate("bad-merge-options")).toEqual([
      "bad-merge-options must be one of type overwrite, merge-template, or merge-current",
    ]);
  });
  it("returns an unknown key exits in options object", () => {
    expect(
      validate({
        unknownKey: "something",
        paths: [
          ["$.here", "merge-template"],
          ["$.inner.nested.*", "merge-template"],
          ["$.inner.nested.final", "merge-current"],
        ],
      }),
    ).toEqual(["Unrecognized key: unknownKey"]);
  });
  it("returns a type error if the options object is an array", () => {
    expect(validate([])).toEqual(["Options must be an object and not Array"]);
  });
  it("returns a type error if the options object is  null", () => {
    expect(validate(null)).toEqual(["Options cannot be null"]);
  });
  it("returns a type error for each path that is invalid", () => {
    expect(
      validate({
        paths: [
          ["$.badc/value", "merge-template"],
          ["no$", "merge-template"],
          ["$.something", "not a value"],
        ],
      }),
    ).toEqual([
      "Invalid jsonpath key: Error: Lexical error on line 1. Unrecognized text.\n$.badc/value\n------^",
      "Unrecognized jsonpath syntax: no$",
      "jsonpath $.something: not a value must be one of type overwrite, merge-template, or merge-current",
    ]);
  });
});
