const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const artifact = require("@actions/artifact");

const BuildScheme = core.getInput("BuildScheme");
const Project = core.getInput("project");
const Configuration = core.getInput("Configuration") || "Release";
const Clean = core.getInput("Clean") || false;

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

    //  find all matching build directories
    const Regex = new RegExp('TARGET_BUILD_DIR = (.*)', 'g');
    const BuildDirectorys = [];
    function OnStdOut(Line)
    {
        console.log(`OnStdOut ${Line} (${typeof Line}`);
        Line = Line.toString(); //  gr; is this not a string?
        //  extract all matches and add to our list
        const Lines = str1.split('\n');
        let Matches = Lines.map( Line => regex1.exec(Line) );
        Matches = Matches.filter( Line => Line!=null );
        Matches = Matches.map( Line => Line[1] );
        BuildDirectorys.push( ...Matches );
      }
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
      ],
      outputOptions
    );
    if ( !BuildDirectorys.length )
        throw `Failed to find any BuildDirectorys from output (looking for TARGET_BUILD_DIR)`;
    console.log(`Build directory determined to be ${BuildDirectorys}`);
    if ( BuildDirectorys.length > 1 )
        console.log(`Found multiple build directories! ${BuildDirectorys}`);
    const BuildDirectory = BuildDirectorys[0];

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
    await exec.exec("xcodebuild", [
      `-scheme`,
      `${BuildScheme}`,
      `-configuration`,
      `${Configuration}`,
    ]);

    //  gr: Scheme.framework is not neccessarily the output
    //  todo: get product name from build settings
    const TargetDir = `${BuildDirectory}/${BuildScheme}.framework`;
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
