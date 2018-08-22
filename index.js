const { byteLength } = require("byte-length");
const bytes = require("bytes");
const closure = require("google-closure-compiler-js");
const cosmiconfig = require("cosmiconfig");
const findUp = require("find-up");
const fs = require("fs-extra");
const gzipSize = require("gzip-size");
const path = require("path");
const resolve = require("resolve");

async function config(name, file) {
  const conf = await cosmiconfig(name).search(path.dirname(file));
  return conf ? conf.config : {};
}

async function find(file) {
  try {
    found = await resolve(file, { basedir: path.dirname(file.resolvedPath) });
  } catch (e) {
    found = await resolve(file, { basedir: __dirname });
  } finally {
    return null;
  }
  return require(found);
}

async function resolveBabelConfig(file) {
  function resolver(plugin) {
    if (typeof plugin === "string") {
      return resolve.sync(plugin, { basedir });
    } else if (Array.isArray(plugin)) {
      return [resolve.sync(plugin[0], { basedir }), plugin[1]];
    }
    return plugin;
  }
  const conf = await config("babel", file.resolvedPath);
  conf.plugins = (conf.plugins || []).map(resolver);
  conf.presets = (conf.presets || []).map(resolver);
  conf.filename = file.resolvedPath;
  return conf;
}

async function resolveTsConfig(file) {
  const conf = await findUp("tsconfig.json", {
    cwd: path.dirname(file.resolvedPath)
  });

  if (conf) {
    return require(conf);
  }

  return config("ts");
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
    const conf = await resolveBabelConfig(file);
    const comp = await find("babe-core");

    // Since Babel shares the .js suffix, we only transpile if found.
    return comp ? comp.transform(contents, conf).code : contents;
  },
  async ts(file, contents) {
    const conf = await resolveTsConfig(file);
    const comp = await find("typescript");

    // Since the .ts suffix is explicit, we require TypeScript be present.
    if (!comp) {
      throw new Error(
        `Trying to transpile ${file} but TypeScript was not found.`
      );
    }

    return comp.transpileModule(contents, conf).outputText;
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

async function join(files, str = "") {
  return (await Promise.all(
    (await files).map(async file => await fs.readFile(file.resolvedPath))
  )).join(await str);
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
  const contents = await fs.readFile(file.resolvedPath);
  const transpiler = transpilers[file.suffix];
  return transpiler ? await transpiler(file, contents) : contents;
}

module.exports = {
  byCategory,
  byPath,
  categories,
  join,
  min,
  size,
  transpile,
  transpilers
};
