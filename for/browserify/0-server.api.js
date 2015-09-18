
const PATH = require("path");
// TODO: Get from `components/Library.NodeJS`
const FS = require("fs-extra");
const BROWSERIFY = require("browserify");
const STRINGIFY = require("stringify");


exports.forLib = function (LIB) {

	var exports = {};

	exports.bundleFiles = function (baseDir, files, distPath) {
		return LIB.Promise.promisify(function (callback) {

			var browserify = BROWSERIFY({
				basedir: baseDir,
				noParse: [
					'systemjs/dist/system.src.js'
				]
	//				standalone: ''
			});
			browserify.transform(STRINGIFY(['.htm', '.html']));
			
			files.forEach(function (path) {
				browserify.add("./" + path);
			});

			return browserify.bundle(function (err, data) {
				if (err) return callback(err);
	
				function appendGlobalScripts (data, callback) {
	
					var re = /;\(\{"APPEND_AS_GLOBAL":"([^"]+)"\}\);/g;
					var m = null;
					while ( (m = re.exec(data)) ) {
						data += '\nvar __define = window.define; window.define = null;\n';
						data += FS.readFileSync(
							// TODO: Suppor paths relative to file here once we can get containing
							//       file info from browserify.
							PATH.join(__dirname, "../../../../" + m[1]),
							"utf8"
						);
						data += '\nif (typeof window.define === "undefined") window.define = __define;\n';
					}
	
					return callback(null, data);
				}
	
				return appendGlobalScripts(data, function (err, data) {
					if (err) return callback(err);
	
					data = require("../defs/export").transform(data);
	
			        return FS.outputFile(distPath, data, "utf8", function (err) {
			        	if (err) return callback(err);
			        	
			        	return callback(null, data);
			        });
				});
			});
		})();
	}

	exports.app = function (options) {
	
	    return function (req, res, next) {
	
	        var path = PATH.join(options.distPath, req.params[0]);
	
			return FS.exists(path, function (exists) {
	
		        if (exists && /\.dist\./.test(path)) {
		           	// We return a pre-built file if it exists and are being asked for it
	
					res.writeHead(200, {
						"Content-Type": "application/javascript"
					});
		           	return FS.createReadStream(path).pipe(res);
	
		        } else {
	
		           	// We build file, store it and return it

		            path = PATH.join(options.basePath, req.params[0]).replace(/\.dist\./, ".");

					return FS.exists(path, function (exists) {
		
			            if (!exists) return next();
	
			            console.log("Browserifying '" + path + "' ...");
	
						return exports.bundleFiles(
							PATH.dirname(path),
							[
								PATH.basename(path)
							],
							PATH.join(options.distPath, req.params[0])
						).then(function (bundle) {
							res.writeHead(200, {
								"Content-Type": "application/javascript"
							});
							return res.end(bundle);
						}).catch(next);
					});
		        }
	        });
	    };
	}

	return exports;
}
