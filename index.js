const util = require("util");
const { byteLength } = require("byte-length");
const bytes = require("bytes");
const closure = require("google-closure-compiler-js");
const cosmiconfig = require("cosmiconfig");
const findUp = require("find-up");
const fs = require("fs-extra");
const gzipSize = require("gzip-size");
const path = require("path");
const resolve = util.promisify(require("resolve"));

async function getConfig(name, file) {
  const conf = await cosmiconfig(name).search();
  return conf ? conf.config : {};
}

async function getContents(file) {
  const cont = await fs.readFile(file.resolvedPath);
  return cont.toString("utf-8");
}

async function find(dep) {
  try {
    return require(await resolve(dep, { basedir: process.cwd() }));
  } catch (e) {
    return null;
  }
}

// ## Public API

const categories = {
  css: ["css", "less", "sass", "styl"],
  html: ["htm", "html"],
  img: ["bmp", "gif", "jpg", "jpeg", "png", "svg", "tiff", "xiff"],
  script: ["js", "ts"]
};

const transpilers = {
  async js(file, contents) {
    const transpiler = await find("babel-core");

    // Since Babel shares the .js suffix, we only transpile if found.
    if (transpiler) {
      // We attempt to transpile using the babelrc in the current project.
      // If we were to allow Babel to use babelrc files here, it would try
      // and load presets / plugins from dependencies in node_modules, and
      // if they're devDependencies, then they won't be found.
      //
      // It's very likely you're getting the pre-transpiled source anyways.
      // This ensures that it's transpiled to what your project expects.
      // This means that if a project is shipped in ES2015, and you require
      // ES5, that the dependency will be transpiled to ES5.
      const config = {
        ...(await getConfig("babel")),
        babelrc: false,
        filename: path.relative(process.cwd(), file.resolvedPath)
      };

      const transpiled = transpiler.transform(contents, config).code;
      return transpiled;
    }

    return contents;
  },
  async ts(file, contents) {
    const transpiler = await find("typescript");

    // Since the .ts suffix is explicit, we require TypeScript be present.
    if (!transpiler) {
      throw new Error(
        `Trying to transpile ${file.resolvedPath} but TypeScript was not found.`
      );
    }

    const config = (await find("./tsconfig.json")) || (await getConfig("ts"));
    return transpiler.transpileModule(contents, config).outputText;
  }
};

function byCategory(category) {
  return function(file) {
    return categories[category].indexOf(file.suffix) > -1;
  };
}

function byPath(matcher) {
  return function(file) {
    return file.resolvedPath.match(matcher);
  };
}

async function min(str) {
  const compiled = closure.compile({
    compilationLevel: "ADVANCED",
    jsCode: [{ src: await str }]
  });
  return compiled.compiledCode;
}

async function size(str, { gz } = { gz: false }) {
  return gz ? gzipSize(await str) : byteLength(await str);
}

async function transpile(file) {
  const contents = await getContents(file);
  const transpiler = transpilers[file.suffix];
  return transpiler ? await transpiler(file, contents) : contents;
}

module.exports = {
  byCategory,
  byPath,
  categories,
  min,
  size,
  transpile,
  transpilers
};
