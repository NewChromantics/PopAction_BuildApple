const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const artifact = require("@actions/artifact");
const normalize = require('path-normalize');

const BuildScheme = core.getInput("BuildScheme");
const Destination = core.getInput("Destination");
const Sdk = core.getInput("Sdk") || false;
const Project = core.getInput("Project") || false;
const Configuration = core.getInput("Configuration") || "Release";
const AdditionalParams = core.getInput("AdditionalParams") || false;
const Clean = core.getInput("Clean") || false;
const Archive = core.getInput("ArchiveForTestFlight").toLowerCase() === 'true';
const AppleID = core.getInput("AppleID");
const ApplePassword = core.getInput("ApplePassword");

const BuildProductDir = core.getInput("BuildTargetDir");

async function run() 
{
	let UploadFilename = BuildProductDir;
	console.log(`BuildProductDir=${BuildProductDir}`);

	if ( !BuildScheme )
		throw `No BuildScheme provided, required.`;

	if (BuildScheme === "PopCameraDevice_Osx")
	{
		console.log(`Installing homebrew specifiically for PopCameraDevice_Osx`);
		await exec.exec("brew", ['install', 'pkg-config'])
	}

	let ProjectPath = Project;
	
	//	append xcodeproj if missing
	if ( ProjectPath && !ProjectPath.endsWith('.xcodeproj') )
		ProjectPath += '.xcodeproj';

	
	//  find all matching build directories
	const Regex =
	{
		BuildDirectorys:
		{
			pattern: new RegExp('BUILT_PRODUCTS_DIR ?= ?(.*)', 'g'),
			results: new Set()
		},
		FullProductName:
		{
			pattern: new RegExp('FULL_PRODUCT_NAME ?= ?(.*)', 'g'),
			results: new Set()
		},
		ScriptOutput:
		{
			pattern: new RegExp('SCRIPT_OUTPUT_FILE_[0-9]+[ /\\/]?= ?(.*)', 'g'),
			results: new Set()
		}
	}

	function OnStdOut(Line)
	{
		//console.log(`OnStdOut ${Line} (${typeof Line}`);
		Line = Line.toString(); //  gr; is this not a string?
		//	extract all matches and add to our lists
		const Lines = Line.split('\n');

		Object.values(Regex).map( key =>
		{
			let Matches = Lines.map( Line => key.pattern.exec(Line) );
			Matches = Matches.filter( Line => Line!=null );
			Matches = Matches.map( Line => Line[1] );
			key.results.add( ...Matches );
		});
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

	
	const BuildOptions = [];
	
	//	add path to project if specified
	if ( ProjectPath )
	{
		BuildOptions.push(`-project`,ProjectPath);
	}
	
	//	require these
	BuildOptions.push(`-scheme`,`${BuildScheme}`);
	BuildOptions.push(`-configuration`,`${Configuration}`);
	BuildOptions.push(`-destination`,`${Destination}`);
	
	if ( AdditionalParams )
		BuildOptions.push( ...AdditionalParams.split(' ') );	
	
	//	add sdk if specified
	if ( Sdk )
	{
		BuildOptions.push(`-sdk`,`${Sdk}`);
	}

	{
		const ListOptions = [];
		if ( ProjectPath )
		{
			ListOptions.push(`-project`,ProjectPath);
		}
		ListOptions.push(`-list`);
		
		console.log(`Listing schemes & configurations...`);
		await exec.exec("xcodebuild", ListOptions );
	}
	
	{
		//  gr: removed
		//    `-workspace`, `${ProjectPath}/project.xcworkspace`,
		//  from these as it was erroring with an unknown error on xcode11/mojave (but okay on xcode10/high sierra)
		const PreBuildOptions = BuildOptions.slice();
		PreBuildOptions.push(`-showBuildSettings`);
	
		console.log(`Listing build settings for BuildScheme=${BuildScheme}...`);
		await exec.exec(
						"xcodebuild",
						PreBuildOptions,
						outputOptions
						);
	}

	//  gr: clean fails for our builds as xcode won't delete our Build/ output dir, so clean is optional
	if ( Clean )
	{
		const CleanBuildOptions = BuildOptions.slice();
		CleanBuildOptions.push(`clean`);
		
		console.log(`Clean with BuildScheme=${BuildScheme}...`);
		await exec.exec("xcodebuild", CleanBuildOptions );
	}
	else
	{
		console.log(`Clean skipped as Clean variable=${Clean}`);
	}

	//  gr: make Release a configuration
	console.log(`Build with ${BuildOptions} ${outputOptions}...`);
	await exec.exec(
		"xcodebuild",
		BuildOptions,
		outputOptions
	);

	if(Archive)
	{
		console.log(`Archive App`);

		if ( !AppleID )
			throw `No Apple ID, required for testflight`

		if ( !ApplePassword )
			throw `No Apple Password, required for testflight`

		const ArchiveBuildOptions = BuildOptions.slice();
		ArchiveBuildOptions.push(`-archivePath`,`./build/${Project}.xarchive`);
			
		await exec.exec(
			`xcodebuild`,
			ArchiveBuildOptions
		);

		// tsdk: Hardcoded the path to the export options plist this may need to be more automated in the future
		console.log(`Export ipa`);
		await exec.exec(
			`xcodebuild`,
			[
				`-archivePath`,
				`./build/${Project}.xarchive`,
				`-exportOptionsPlist`,
				`Source_Ios/exportOptions.plist`,
				`-exportPath`,
				`./build`,
				`-allowProvisioningUpdates`,
				`-exportArchive`,
			]
		);

		//	gr: remove all this. Superceded by actions specific for testflight uploads
		console.log("Publish app")
		await exec.exec(
						`xcrun`,
						[
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
						]
		);
	}

	//  gr: Scheme.framework is not neccessarily the output
	//  todo: get product name from build settings
	let TargetDir;

	//  tsdk: For some reason these have undefined as the first item in the set?
	Object.values(Regex).map( key => key.results.delete(undefined));

	if( Regex.BuildDirectorys.results.size && Regex.FullProductName.results.size)
	{
		console.log(`Using a Build Directory and FullProductName output: `)
		console.log(Regex.BuildDirectorys.results)
		console.log(Regex.FullProductName.results)

		// This is how you get the first item of a set
		TargetDir = Regex.BuildDirectorys.results.values().next().value;

		let FileName = Regex.FullProductName.results.values().next().value;

		TargetDir += `/${FileName}`;
		//    use the filename specified, as the upload filename
		if ( !UploadFilename )
			UploadFilename = FileName;
	}
	else if ( Regex.ScriptOutput.results.size )
	{
		console.log(`Using a script output: `)
		console.log(Regex.ScriptOutput.results);
		if ( Regex.ScriptOutput.results.size > 1 )
		{
			console.log(`Warning: Found multiple script output files!`);
			TargetDir = Regex.ScriptOutput.results.values().next().value;
		}
	}
	else
	{
		Object.values(Regex).map( key => console.log(key.results));
		throw `Failed to find valid BuildDirectorys, FullProduct Names or Script Outputs from stdout`;
	}

	TargetDir = normalize(TargetDir);

	console.log(`TargetDir=${TargetDir} (ls before upload)`);
	await exec.exec("ls -l", [TargetDir] );

	console.log(`Uploading (UPLOAD_NAME=${UploadFilename}), with UPLOAD_DIR=${TargetDir}`);
	core.setOutput('UPLOAD_NAME', UploadFilename);
	core.setOutput('UPLOAD_DIR', TargetDir);
}

//  if this throws, set a github action error
run().catch( e => core.setFailed(`${e}`) );
