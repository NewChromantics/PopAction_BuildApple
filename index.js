const core = require(`@actions/core`);
const github = require(`@actions/github`);
const exec = require(`@actions/exec`);
const artifact = require(`@actions/artifact`);

const Project = core.getInput(`project`);
const Publish = core.getInput(`publish`).toLowerCase() === `true`;
const AppleID = core.getInput(`AppleID`);
const ApplePassword = core.getInput(`ApplePassword`);

async function run() 
{
  try
  {
    if ( !Project )
      throw `No Project provided, required.`;
        
    if (BuildScheme === `PopCameraDevice_Osx`) {
      await exec.exec(`brew`, [`install`, `pkg-config`])
    }

    // Set the build paths
    const BUILDPATH_IOS=`./build/${Project}_Ios`
    const BUILDPATH_SIM=`./build/${Project}_IosSimulator`
    const BUILDPATH_OSX=`./build/${Project}_Osx`
    // Create the archives
    await exec.exec(`xcodebuild`, [`archive`, `-scheme`, `${Project}_Ios`, `-archivePath`, `${BUILDPATH_IOS}`, `SKIP_INSTALL=NO`, `-sdk`, `iphoneos`])
    await exec.exec(`xcodebuild`, [`archive`, `-scheme`, `${Project}_Ios`, `-archivePath`, `${BUILDPATH_SIM}`, `SKIP_INSTALL=NO`, `-sdk`, `iphonesimulator`])
    await exec.exec(`xcodebuild`, [`archive`, `-scheme`, `${Project}_Osx`, `-archivePath`, `${BUILDPATH_OSX}`, `SKIP_INSTALL=NO`])

    // Create xcframework
    await exec.exec(`xcodebuild`, [`-create-xcframework`, `-framework`,
                                   `${BUILDPATH_IOS}.xcarchive/Products/Library/Frameworks/${Project}_Ios.framework`, `-framework`,
                                   `${BUILDPATH_SIM}.xcarchive/Products/Library/Frameworks/${Project}_Ios.framework`, `-framework`,
                                   `${BUILDPATH_OSX}.xcarchive/Products/Library/Frameworks/${Project}_Osx.framework`, `-output`,
                                   `./build/${Project}.xcframework`])

    if(Publish)
    {
      if ( !AppleID )
        throw `No Apple ID, required for testflight`

      if ( !ApplePassword )
        throw `No Apple Password, required for testflight`

      console.log(`Archive App`);
      await exec.exec(`xcodebuild`, [
        `-scheme`,
        `${BuildScheme}`,
        `-configuration`,
        `${Configuration}`,
        `-archivePath`,
        `./build/${Project}.xarchive`
      ]);

      // tsdk: Hardcoded the path to the export options plist this may need to be more automated in the future
      console.log(`Export ipa`);
      await exec.exec(`xcodebuild`, [
        `-archivePath`,
        `./build/${Project}.xarchive`,
        `-exportOptionsPlist`,
        `Source_Ios/exportOptions.plist`,
        `-exportPath`,
        `./build`,
        `-allowProvisioningUpdates`,
        `-exportArchive`,
      ]);

      console.log(`Publish app`)
      await exec.exec(`xcrun`, [
        `altool`,
        `—`,
        `upload-app`,
        `-t`,
        `ios`,
        `-f`,
        `./build/${Project}_Ios.ipa`,
        `-u`,
        AppleID,
        `-p`,
        ApplePassword
      ]);
    }

    // Set these here but might be redundant now as they are all packagaed together
    core.exportVariable(`UPLOAD_NAME`, `xcframeworks`);
    core.exportVariable(`UPLOAD_DIR`, `Apple`);
  }
  catch (error) 
  {
    core.setFailed(error.message);
  }
}

run();
