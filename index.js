const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const artifact = require("@actions/artifact");

const BuildScheme = core.getInput("BuildScheme");
const Project = core.getInput("project");
const Configuration = core.getInput("Configuration") || "Release";

const BuildProject = `${Project}.xcodeproj`;

async function run() 
{
  try 
  {
    if ( !BuildScheme )
      throw `No BuildScheme provided, required.`;
        
    if ( !Project )
      throw `No Project provided, required.`;
        
    if (BuildScheme === "PopCameraDevice_Osx") {
      await exec.exec("brew", ['install', 'pkg-config'])
    }

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
    console.log(`Build directory determined to be ${buildDirectory}`);

    //  gr: removed  
    //    `-workspace`, `${BuildProject}/project.xcworkspace`,
    //  from these as it was erroring with an unknown error on xcode11/mojave (but okay on xcode10/high sierra)
  
    console.log(`Listing schemes & configurations...`);
    await exec.exec("xcodebuild", [
      `-list`,
    ]);

    console.log(`Listing build settings for BuildScheme=${BuildScheme}...`);
    await exec.exec(
      "xcodebuild",
      [
        `-scheme`,
        `${BuildScheme}`,
        `-showBuildSettings`,
      ],
      outputOptions
    );

    //  gr: clean first, just in case
    console.log(`Clean with BuildScheme=${BuildScheme}...`);
    await exec.exec("xcodebuild", [
      `-scheme`,
      `${BuildScheme}`,
      `clean`,
    ]);

    //  gr: make Release a configuration
    console.log(`Build with BuildScheme=${BuildScheme}, Configuration=${Configuration}...`);
    await exec.exec("xcodebuild", [
      `-scheme`,
      `${BuildScheme}`,
      `-configuration`,
      `${Configuration}`,
    ]);

    //  gr: Scheme.framework is not neccessarily the output
    //  todo: get product name from build settings
    const TargetDir = `${buildDirectory[1]}/${BuildScheme}.framework`;
    console.log(`TargetDir=${TargetDir} (ls before upload)`);
    await exec.exec("ls", [TargetDir] );

    console.log(`Uploading ${TargetDir}`);
    core.exportVariable('UPLOAD_NAME', `${BuildScheme}.framework`);
    core.exportVariable('UPLOAD_DIR', `${TargetDir}`);
  } 
  catch (error) 
  {
    core.setFailed(error.message);
  }
}

run();
