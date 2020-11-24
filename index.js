const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const artifact = require("@actions/artifact");

const BuildScheme = core.getInput("BuildScheme");
const Project = core.getInput("project");
const Configuration = core.getInput("Configuration") || "Release";
const Clean = core.getInput("Clean") || false;
const Archive = core.getInput("ArchiveForTestFlight").toLowerCase() === 'true';
const AppleID = core.getInput("AppleID");
const ApplePassword = core.getInput("ApplePassword");

const BuildProject = `${Project}.xcodeproj`;
const BuildProductDir = core.getInput("BuildTargetDir") || `${BuildScheme}.framework`;

async function run() 
{
  console.log(`UPLOAD_NAME=${BuildProductDir}`);
  try 
  {
    if ( !BuildScheme )
      throw `No BuildScheme provided, required.`;
        
    if ( !Project )
      throw `No Project provided, required.`;
        
    if (BuildScheme === "PopCameraDevice_Osx") {
      await exec.exec("brew", ['install', 'pkg-config'])
    }

    //  find all matching build directories
    const TargetBuildRegex = new RegExp('TARGET_BUILD_DIR ?= ?(.*)', 'g');
    const ScriptOutputRegex = new RegExp('SCRIPT_OUTPUT_FILE_[0-9]+ ?= ?(.*)', 'g');
    const BuildFilenames = new Set();
    const BuildDirectorys = new Set();
    function OnStdOut(Line)
    {
        console.log(`OnStdOut ${Line} (${typeof Line}`);
        Line = Line.toString(); //  gr; is this not a string?
        //  extract all matches and add to our list
        const Lines = Line.split('\n');

        let Matches = Lines.map( Line => TargetBuildRegex.exec(Line) );
        Matches = Matches.filter( Line => Line!=null );
        Matches = Matches.map( Line => Line[1] );
        BuildDirectorys.add( ...Matches );

        // reset matches and run again for Script Output
        Matches = Lines.map( Line => ScriptOutputRegex.exec(Line) );
        Matches = Matches.filter( Line => Line!=null );
        Matches = Matches.map( Line => Line[1] );
        BuildFilenames.add( ...Matches );
    }
    function OnError(Line)
    {
        console.log(`STDERR ${Line.toString()}`);
    }
    const outputOptions = {};
    outputOptions.listeners = {
      stdout: OnStdOut,
      stderr: OnError
    };

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
        `-configuration`,
        `${Configuration}`
      ],
      outputOptions
    );

    if( BuildFilenames.size )
    {
      console.log(`BuildFilenames determined to be ${BuildFilenames}`)
      if( BuildFilenames.size > 1 )
        throw `More than one output file name for SCRIPT_OUTPUT_FILE_[0-9]+, not handled`

      const BuildDirectory = BuildFilenames[0];
    }
    else if ( BuildDirectorys.size )
    {
      console.log(`Build directory determined to be ${BuildDirectorys}`);
      if ( BuildDirectorys.size > 1 )
      {
        console.log(`Found multiple build directories! ${BuildDirectorys}`);
        const BuildDirectory = BuildDirectorys[0];
      }
    }
    else
    {
      throw `Failed to find any BuildFilenames or BuildDirectorys from output (looking for SCRIPT_OUTPUT_FILE_[0-9]+ OR TARGET_BUILD_DIR)`;
    }

    //  gr: clean fails for our builds as xcode won't delete our Build/ output dir, so clean is optional
    if ( Clean )
    {
		//  gr: clean first, just in case
     	console.log(`Clean with BuildScheme=${BuildScheme}...`);
    	await exec.exec("xcodebuild", [
    		`-scheme`,
      		`${BuildScheme}`,
      		`clean`,
    	]);
	  }
    else 
    {
      console.log(`Clean skipped as Clean variable=${Clean}`);
    }

    //  gr: make Release a configuration
    console.log(`Build with BuildScheme=${BuildScheme}, Configuration=${Configuration}...`);
    await exec.exec(
      "xcodebuild",
      [
        `-scheme`,
        `${BuildScheme}`,
        `-configuration`,
        `${Configuration}`,
      ],
      outputOptions
    );

    if(Archive)
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

      console.log("Publish app")
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

    //  gr: Scheme.framework is not neccessarily the output
    //  todo: get product name from build settings
    // Only use the TARGET_BUILD_DIR if there is no SCRIPT_OUTPUT_FILE
    if(!BuildFilenames.size)
    {
      const TargetDir = `${BuildDirectory}/${BuildProductDir}`;
    }

    console.log(`TargetDir=${TargetDir} (ls before upload)`);
    await exec.exec("ls", [TargetDir] );

	  //	gr: we DONT want to rename the target .framework or .app, so it's the same as the target dir
	  //		possibly we may need to strip other paths later?
    console.log(`Uploading (UPLOAD_NAME=${BuildProductDir}), with UPLOAD_DIR=${TargetDir}`);
    core.exportVariable('UPLOAD_NAME', BuildProductDir);
    core.exportVariable('UPLOAD_DIR', TargetDir);
  } 
  catch (error) 
  {
    core.setFailed(error.message);
  }
}

run();
