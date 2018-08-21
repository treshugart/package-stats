const { byCategory, gz, join, min, raw, size, trace } = require(".");

test("byCategory", () => {
  const files = [
    { suffix: "css" },
    { suffix: "less" },
    { suffix: "js" },
    { suffix: "ts" }
  ];
  expect(files.filter(byCategory("script"))).toEqual([
    { suffix: "js" },
    { suffix: "ts" }
  ]);
  expect(files.filter(byCategory("css"))).toEqual([
    { suffix: "css" },
    { suffix: "less" }
  ]);
});

test("gz", async () => {
  const files = ['"test 1";', '"test 2";'];
  expect(await gz(files)).toBe(34);
});

test("join", async () => {
  const files = ['"test 1";', '"test 2";'];
  expect(await join(files)).toBe('"test 1";"test 2";');
});

test("min", async () => {
  const files = [{ min: '"test 1";' }, { min: '"test 2";' }];
  expect(await Promise.all(await min(files))).toEqual([
    '"test 1";',
    '"test 2";'
  ]);
});

test("raw", async () => {
  const files = [{ raw: '"test 1";' }, { raw: '"test 2";' }];
  expect(await Promise.all(await raw(files))).toEqual([
    '"test 1";',
    '"test 2";'
  ]);
});

test("size", async () => {
  const files = ['"test 1";', '"test 2";'];
  expect(await size(files)).toBe(18);
});

test("trace", async () => {
  const files = await trace(".");
  expect(files.length).toBe(1);
  const entry = {
    get raw() {
      return '"test 1";\n"test 2";';
    }
  };
  Object.defineProperty(
    entry,
    "min",
    Object.getOwnPropertyDescriptor(files[0], "min")
  );
  expect(await entry.min).toBe('"test 1";"test 2";');
});
