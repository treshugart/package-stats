const { byteLength } = require("byte-length");
const bytes = require("bytes");
const closure = require("google-closure-compiler-js");
const cosmiconfig = require("cosmiconfig");
const findUp = require("find-up");
const fs = require("fs");
const gzipSize = require("gzip-size");
const path = require("path");
const resolve = require("resolve");
const sourceTrace = require("source-trace");

const transpilers = {
  js: createTranspiler("babel-core", async (js, file, contents) => {
    const babelJson = await cosmiconfig("babel").search();
    return js.transform(contents, babelJson ? babelJson.config : undefined)
      .code;
  }),
  ts: createTranspiler("typescript", async (ts, file, contents) => {
    const tsconfigPath = await findUp("tsconfig.json", {
      cwd: path.dirname(file.resolvedPath)
    });
    const tsconfigJson = tsconfigPath ? require(tsconfigPath) : {};
    return ts.transpileModule(contents, tsconfigJson).outputText;
  })
};

function createTranspiler(transpiler, caller) {
  return (file, contents) => {
    try {
      const transpilerPath = resolve.sync(transpiler, {
        basedir: path.dirname(file.resolvedPath)
      });
      const transpilerModule = require(transpilerPath);
      return caller(transpilerModule, file, contents);
    } catch (e) {
      return contents;
    }
  };
}

async function transpile(file) {
  const contents = fs.readFileSync(file.resolvedPath).toString("utf-8");
  const transpiler = transpilers[file.suffix];
  return transpiler ? await transpiler(file, contents) : contents;
}

// ## Public API

const categories = {
  css: ["css", "less", "sass", "styl"],
  html: ["htm", "html"],
  img: ["bmp", "gif", "jpg", "jpeg", "png", "svg", "tiff", "xiff"],
  script: ["js", "ts"]
};

function byCategory(category) {
  return function(file) {
    return categories[category].indexOf(file.suffix) > -1;
  };
}

async function join(arr, str = "") {
  return (await Promise.all(await arr)).join(await str);
}

async function gz(arr) {
  return gzipSize(await join(arr));
}

async function min(arr) {
  return Promise.resolve(await arr.map(async a => await a.min));
}

async function raw(arr) {
  return Promise.resolve(await arr.map(async a => await a.raw));
}

async function size(arr) {
  return byteLength(await join(arr));
}

async function trace(entries) {
  const traced = await sourceTrace(entries);
  return traced.map(file => {
    return {
      ...file,
      get min() {
        return (async () =>
          closure.compile({
            compilationLevel: "ADVANCED",
            jsCode: [{ src: await this.raw }]
          }).compiledCode)();
      },
      get raw() {
        return transpile(file);
      }
    };
  });
}

module.exports = {
  byCategory,
  gz,
  join,
  min,
  raw,
  size,
  trace
};
