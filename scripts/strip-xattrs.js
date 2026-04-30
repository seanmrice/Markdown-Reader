const { execFileSync } = require("child_process");

exports.default = async function (context) {
  console.log("  • stripping extended attributes from", context.appOutDir);
  execFileSync("xattr", ["-cr", context.appOutDir]);
};
