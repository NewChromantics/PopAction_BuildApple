PopAction_BuildApple
==========
This action is to ease building xcode schemes.

Inputs
--------------

There are 2 required inputs to the action
  - BuildScheme 
  - Project

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
