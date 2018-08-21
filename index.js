const { byteLength } = require("byte-length");
const bytes = require("bytes");
const closure = require("google-closure-compiler-js");
const cosmiconfig = require("cosmiconfig");
const findUp = require("find-up");
const fs = require("fs");
const gzipSize = require("gzip-size");
const path = require("path");
const resolve = require("resolve");
const { trace: sourceTrace } = require("source-trace");

function resolveBabelPlugin(file) {
  const basedir = path.dirname(file.resolvedPath);
  return function(plugin) {
    if (typeof plugin === "string") {
      return resolve.sync(plugin, { basedir });
    } else if (Array.isArray(plugin)) {
      return [resolve.sync(plugin[0], { basedir }), plugin[1]];
    }
    return plugin;
  };
}

const transpilers = {
  js: createTranspiler("babel-core", async (js, file, contents) => {
    const babelJson = await cosmiconfig("babel").search(
      path.dirname(file.resolvedPath)
    );
    if (babelJson) {
      const resolver = resolveBabelPlugin(file);
      babelJson.config.plugins = (babelJson.plugins || []).map(resolver);
      babelJson.config.presets = (babelJson.presets || []).map(resolver);
      babelJson.config.filename = file.resolvedPath;
    }
    return js.transform(
      contents,
      babelJson ? babelJson.config : { filename: file.resolvedPath }
    ).code;
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
  return transpiler && file.resolvedPath.indexOf("node_modules") === -1
    ? await transpiler(file, contents)
    : contents;
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

async function trace(entries, opts) {
  const traced = await sourceTrace(entries, opts);
  return traced.map(file => {
    return {
      ...file,
      get min() {
        return (async () => {
          const compiled = closure.compile({
            compilationLevel: "ADVANCED",
            jsCode: [{ src: await this.raw }]
          });
          return compiled.compiledCode;
        })();
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
