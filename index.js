const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const artifact = require("@actions/artifact");

const BuildScheme = core.getInput("BuildScheme");
const Project = core.getInput("project");
const UploadArtifact = core.getInput("UploadArtifact");

const BuildProject = `${Project}.xcodeproj`;

async function run() {
  try {
    if (BuildScheme === "PopCameraDevice_Osx") {
      await exec.exec("brew", ["install", "nuget"]);
      await exec.exec("nuget", ["install"], { cwd: "./Source/libs" });
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

    if (UploadArtifact) {
      // Get BuildDirectory
      const regex = /TARGET_BUILD_DIR = ([\/-\w]+)\n/;
      let buildDirectory = "";
      let myError = "";
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

      buildDirectory = buildDirectory[1];
      await exec.exec("ls", [buildDirectory]);

      const artifactClient = artifact.create();
      const artifactName = `${BuildScheme}.framework`;

      await exec.exec(
        "zip",
        ["-r", `${BuildScheme}.framework.zip`, `${BuildScheme}.framework`],
        { cwd: buildDirectory }
      );

      const files = [`${buildDirectory}/${BuildScheme}.framework.zip`];
      const rootDirectory = buildDirectory;
      const options = {
        continueOnError: true,
      };

      const uploadResult = await artifactClient.uploadArtifact(
        artifactName,
        files,
        rootDirectory,
        options
      );
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
