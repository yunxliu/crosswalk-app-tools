// Copyright © 2014 Intel Corporation. All rights reserved.
// Use  of this  source  code is  governed by  an Apache v2
// license that can be found in the LICENSE-APACHE-V2 file.

var FS = require("fs");
var Path = require("path");

var MkTemp = require("mktemp");
var ShellJS = require("shelljs");

var Downloader = require("../util//Downloader");
var IndexParser = require("../util/IndexParser");

var BASE_URL = "https://download.01.org/crosswalk/releases/crosswalk/android/";
var CHANNELS = ["beta", "canary", "stable"];



/**
 * Callback signature for {@link AndroidProjectDeps.fetchVersions}
 * @param {String[]} versions Array of available Crosswalk versions sorted oldest - newest
 * @param {String} errormsg Message in case of Error
 * @inner
 * @memberOf AndroidProjectDeps
 */
function fetchVersionsFinishedCb(versions, errormsg) {}

/**
 * Callback signature for {@link AndroidProjectDeps.download}.
 * @param {String} path Path to downloaded file, or null on error
 * @param {String} errormsg null if success, otherwise error message
 * @inner
 * @memberOf AndroidProjectDeps
 */
function downloadFinishedCb(path, errormsg) {}



/**
 * Android project dependencies download and lookup.
 * @constructor
 * @param {Application} application application instance
 * @param {String} channel Crosswalk channel beta/canary/stable
 * @throws {AndroidProjectDeps~InvalidChannelError} If no valid channel was specified.
 */
function AndroidProjectDeps(application, channel) {

    this._application = application;

    if (CHANNELS.indexOf(channel) == -1) {
        throw new InvalidChannelError("Unknown channel " + channel);
    }

    this._channel = channel;
}

/**
 * Fetch available Crosswalk versions index.
 * @param {AndroidProjectDeps~fetchVersionsFinishedCb} callback callback function
 */
AndroidProjectDeps.prototype.fetchVersions =
function(callback) {

    var output = this._application.getOutput();
    var url = BASE_URL + this._channel + "/";
    // TODO use memory stream instead of tmpfile
    var indexFile = MkTemp.createFileSync('index.html.XXXXXX');
    if (indexFile) {

        // TODO fix this hack by creating and opening tmpfiles atomically somehow
        ShellJS.rm(indexFile);

        // Download
        var label = "Fetching '" + this._channel + "' versions index";
        var indicator = output.createFiniteProgress(label);
        var downloader = new Downloader(url, indexFile);
        downloader.progress = function(progress) {
            indicator.update(progress);
        };
        downloader.get(function(errormsg) {

            indicator.done("");

            if (errormsg) {

                callback(null, errormsg);

            } else {

                // Parse
                var buffer = FS.readFileSync(indexFile, {"encoding": "utf8"});
                var parser = new IndexParser(buffer);
                var versions = parser.parse();
                callback(versions);
            }

            ShellJS.rm(indexFile);
        });
    } else {

        callback(null, "Failed to download package index.");
        ShellJS.rm(indexFile);
        return;
    }
};

/**
 * Locate Crosswalk distribution zip.
 * @param {String} version Crosswalk version to look for
 * @returns {String} Relative path to zip file.
 */
AndroidProjectDeps.prototype.findLocally =
function(version) {

    var filename = "crosswalk-" + version + ".zip";
    if (ShellJS.test("-f", filename))  {
        return filename;
    } else if (ShellJS.test("-f", "../" + filename)) {
        // Also try parent dir.
        // This is especially useful for tests that run in a temporary dir.
        return "../" + filename;
    }

    return null;
};

/**
 * Download crosswalk zip.
 * @param {String} version Crosswalk version string
 * @param {String} dir Directory to download to
 * @param {AndroidProjectDeps~downloadFinishedCb} callback callback function
 */
AndroidProjectDeps.prototype.download =
function(version, dir, callback) {

    var output = this._application.getOutput();
    var filename = "crosswalk-" + version + ".zip";
    var url = BASE_URL +
              this._channel + "/" +
              version + "/" +
              filename;

    // Download
    // At the moment we unconditionally download, overwriting the existing copy.
    var label = "Downloading '" + this._channel + "' " + version;
    var indicator = output.createFiniteProgress(label);
    var path = Path.join(dir, filename);
    var downloader = new Downloader(url, path);
    downloader.progress = function(progress) {
        indicator.update(progress);
    };
    downloader.get(function(errormsg) {

        indicator.done("");

        if (errormsg) {

            callback(null, errormsg);

        } else {

            callback(path);
        }
    });
};



/**
 * Creates a new InvalidChannelError.
 * @extends Error
 * @constructor
 * @param {String} message Error message
 * @inner
 * @memberOf AndroidProjectDeps
 */
function InvalidChannelError(message) {
    Error.call(this, message);
}
InvalidChannelError.prototype = Error.prototype;

AndroidProjectDeps.prototype.InvalidChannelError = InvalidChannelError;



module.exports = AndroidProjectDeps;
