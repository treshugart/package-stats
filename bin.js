#!/usr/bin/env node

const meow = require("meow");
const chalk = require("chalk");
const bytes = require("bytes");
const { trace } = require("source-trace");
const { byCategory, join, min, size, transpile } = require(".");

const cli = meow("$ meow <files>");
const flags = { g: false, m: false, ...cli.flags };

async function print(category, deps) {
  deps = await Promise.all(await deps);
  deps = await Promise.all(await deps.filter(byCategory("script")));
  deps = await Promise.all(
    await deps.filter(dep => dep.resolvedPath.indexOf("node_modules") === -1)
  );
  deps = await Promise.all(deps.map(transpile));
  deps = deps.join("");
  deps = flags.m ? await min(deps) : deps;
  console.log(
    chalk.yellow(category),
    chalk.green(bytes(await size(deps, { gz: flags.g })))
  );
}

(async function() {
  const deps = trace(cli.input[0], {
    mains: ["main", "module", "atlaskit:src"]
  });
  print("script", deps);
})();
