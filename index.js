const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const artifact = require("@actions/artifact");

const BuildScheme = core.getInput("BuildScheme");
const Project = core.getInput("project");

const regex = /TARGET_BUILD_DIR = ([\/-\w]+)\n/;
let buildDirectory = "";
let myError = "";
const options = {};

const BuildProject = `${Project}.xcodeproj`;

async function run() {
  try {
    if (BuildScheme === "PopCameraDevice_Osx") {
      await exec.exec("brew", ["install", "nuget"]);
      options.cwd = "./Source/libs";
      await exec.exec("nuget", ["install"], options);
    }

    // Get BuildDirectory
    const outputOptions = {};
    outputOptions.listeners = {
      stdout: (data) => {
        buildDirectory += data.toString();
        console.log(regex.exec(buildDirectory));
        buildDirectory = regex.exec(buildDirectory);
      },
      stderr: (data) => {
        myError += data.toString();
      },
    };

    await exec.exec(
      "xcodebuild",
      [
        `-workspace`,
        `${BuildProject}/project.xcworkspace`,
        `-scheme`,
        `${BuildScheme}`,
        `-showBuildSettings`,
      ],
      outputOptions
    );

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

    console.log(buildDirectory)

    core.setOutput('buildDirectory', (buildDirectory[0]));
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
