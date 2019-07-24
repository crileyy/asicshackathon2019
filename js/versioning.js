// This function gets modified by grunt during the build to populate the versionMap variable below with an actual mapping
// from original filename to versioned filename. This method need only be used for dynamically generated filenames. All
// static names used in files should get updated by grunt directly during the build.
//
function getVersionedFilename(filename) {
    // This is empty in the committed file. It will be populated by the build process via code generation.
    var versionMap = {};

    // Look for a match
    for (var i = 0; i < versionMap.length; ++i) {
        var mapping = versionMap[i];
        if (mapping.match.test(filename)) {
            return filename.replace(mapping.match, mapping.replacement);
        }
    }

    // If we didn't find a match, just return the original filename.
    return filename;
}

