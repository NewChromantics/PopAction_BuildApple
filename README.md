PopAction_BuildApple
==========
This action is to ease building xcode schemes.

Required Inputs
--------------
- `BuildScheme` Name of the scheme you wish to build 
- `Destination` This is to specify the platform to build to; this was added as IOS schemes would often default to a simulator.
	- The build logs will list all destinations for a project + scheme. via `xcodebuild -scheme XXX -showBuildSettings`
	- This is sent to `xcodebuild -destination YOURDESTINATION`
	- see `man xcodebuild` or https://mokacoding.com/blog/xcodebuild-destination-options/
	- `"generic/platform=iOS"` Any IOS device platform
	- `"platform=macOS,arch=x86_64"`
	- `"platform=iOS Simulator,name=iPhone 6,OS=9.1"`
	- `"platform=macOS"`

Optional Inputs
- `Sdk` becomes `-sdk XXX`  
- `Project` path to `.xcodeproj` directory for building
	- passed to `xcodebuild -project $Project`
	- Code will auto add `.xcodeproj` if not provided
	- `xcodebuild` will use current working directory if not provided
	- In versions before `1.3.0` Project was `project` (lowercase!)
	- In versions before `1.3.1` this was required

The other inputs are related to Publishing to Testflight
  - ArchiveForTestFlight = bool (used in an if statement)
  - AppleID
  - ApplePassword

Outputs
---------------
- `v1.1.X` would output these variables to `env.` (with `core.exportVariable`)
	- `v1.2.0` now sets `GITHUB_OUTPUT`'s (with `core.setOutput`)

- This action extracts the build artifact/productname and the target directory based on xcode's output (NOT hardcoded!) 
	- `UPLOAD_NAME` is set to the final build "filename" eg. `YourApp.dylib` or `YourApp.app`
	- `UPLOAD_DIR` is set to the local path to where that filename is located
