#!/usr/bin/env node

const meow = require("meow");
const chalk = require("chalk");
const bytes = require("bytes");
const { byCategory, gz, min, raw, size, trace } = require(".");

const cli = meow("$ meow <files>");
const flags = { g: false, m: false, ...cli.flags };

async function print(category, dependencies) {
  let deps = await Promise.all(await dependencies);
  deps = deps.filter(byCategory("script"));
  deps = flags.m ? min(deps) : raw(deps);
  console.log(
    chalk.yellow(category),
    chalk.green(bytes(await (flags.g ? gz(deps) : size(deps))))
  );
}

(async function() {
  const dependencies = await trace(cli.input[0]);
  print("script", dependencies);
})();
