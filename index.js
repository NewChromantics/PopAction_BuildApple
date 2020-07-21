const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const artifact = require("@actions/artifact");
const glob = require("@actions/glob");

const BuildScheme = core.getInput("BuildScheme");
const Project = core.getInput("project");

const BuildProject = `${Project}.xcodeproj`;

async function run() {
  try {
    if (BuildScheme === "PopCameraDevice_Osx") {
      await exec.exec("brew", ["install", "nuget"]);
      options.cwd = "./Source/libs";
      await exec.exec("nuget", ["install"], options);
    }

    await exec.exec("xcodebuild", [
      `-workspace`,
      `${BuildProject}/project.xcworkspace`,
      `-list`,
    ]);

    await exec.exec("xcodebuild", [
      `-workspace`,
      `${BuildProject}/project.xcworkspace`,
      `-scheme`,
      `${BuildScheme}`,
      `-configuration`,
      `Release`,
    ]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
