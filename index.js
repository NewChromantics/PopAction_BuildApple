const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const artifact = require("@actions/artifact");
const glob = require('@actions/glob')

const BuildScheme = core.getInput("BuildScheme");

const BuildProject = `${core.getInput("project")}.xcodeproj`;

const artifactClient = artifact.create();
const artifactName = BuildScheme;

const regex = /TARGET_BUILD_DIR = ([\/-\w]+)\n/;
let buildDirectory = "";
let myError = "";

const patterns = ['**/build/*']


async function run() {
  try {
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
    ]);

    
    let reg = /([\w-])+$/
    buildDirectory = reg.exec(buildDirectory)
    console.log(buildDirectory[0])

    const globber = await glob.create(patterns.join('\n'))
    console.log(await globber.glob())

    const files = [
      `build/Release-iphoneos/PopH264_Ios.framework`,
      `build/Release-iphoneos/PopH264_Ios.framework.dSYM`,
    ];
     //${BuildScheme}.framework`,
      //${BuildScheme}.framework.dSYM`,
    const rootDirectory = ".";

    const options = {
      continueOnError: true,
    };
    const uploadResponse = await artifactClient.uploadArtifact(
      artifactName,
      files,
      rootDirectory,
      options
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
