const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const artifact = require("@actions/artifact");
const glob = require('@actions/glob')

const BuildScheme = core.getInput("BuildScheme");

const BuildProject = `${core.getInput("project")}.xcodeproj`;

async function run() {
  try {

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
