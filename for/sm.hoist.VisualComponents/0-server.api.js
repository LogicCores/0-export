
const PATH = require("path");
const FS = require("fs");
const ESCAPE_REGEXP_COMPONENT = require("escape-regexp-component");
const EXPORT = require("./export");


exports.app = function (options) {

    return function (req, res, next) {

        var uri = req.params[0];

        var htmRequested = /\.html?$/.test(uri);
        if (!htmRequested) {
            uri += ".htm" + (/\/index$/.test(uri) ? "l":"");
        }
        var baseUri = PATH.dirname(uri);
        var filename = PATH.basename(uri);

        // TODO: Refactor to 'cores/overlay'
        function locateFile (baseUri, filename, callback) {
            var path = PATH.join(options.basePath, baseUri, filename);
            return FS.exists(path, function (exists) {
                if (exists) {
                    return callback(null, PATH.join(baseUri, filename));
                }
                // If the exact path is not found we check for an index file.
                path = PATH.join(options.basePath, baseUri, "index.html");
                return FS.exists(path, function (exists) {
                    if (exists) {
                        return callback(null, PATH.join(baseUri, "index.html"));
                    }
                    // The original path nor index file was found so we fall back
                    // to the file of the parent secion and let the
                    // client load the correct page content based on
                    // window.location.pathname
                    var parentBaseUri = PATH.dirname(baseUri);
                    if (parentBaseUri === baseUri) {
                        var err = new Error("No file found for uri: " + uri);
                        err.code = 404;
                        return callback(err);
                    }
                    return locateFile(parentBaseUri, filename, callback);
                });
            });
        }

        return locateFile(baseUri, filename, function (err, uri) {
            if (err) return next(err);
            
            var path = PATH.join(options.basePath, uri);

            if (htmRequested) {

                // The route was requested with the 'htm' extension so we serve
                // the raw file instead of the componentifed file.
                // TODO: Remove this option and return 404 in production.

                // We convert the namespaced 'component' attributes as jQuery has a hard
                // time selcting attributes with colons in it. Likely true for many other
                // parsers as well.
                if (/;convert-to-data;/.test(req.headers["x-component-namespace"] || "")) {
                    return FS.readFile(path, "utf8", function (err, html) {
                        if (err) return next(err);
                
						var re = /(<|\s)component\s*:\s*([^=]+)(\s*=\s*"[^"]*"(?:\/?>|\s))/g;
						var m;
						while ( (m = re.exec(html)) ) {
							html = html.replace(
							    new RegExp(ESCAPE_REGEXP_COMPONENT(m[0]), "g"),
							    m[1] + "data-component-" + m[2].replace(/:/g, "-") + m[3]
							);
						}
                        res.writeHead(200, {
                            "Content-Type": "text/html"
                        });
                        res.end(html);
                        return;
                    });
                }

                return FS.createReadStream(path).pipe(res);
            }

            return EXPORT.parseForUri(
                PATH.join(options.basePath, "components.json"),
                uri,
                function (err, manifest) {
                    if (err) return next(err);
                    
                    if (
                        !manifest.components ||
                        !manifest.components.html ||
                        !manifest.components.html.fsHtmlPath
                    ) {
                        var err = new Error("'html' component not declared in exports for uri '" + uri + "'!");
                        err.code = 404;
                        return next(err);
                    }

                    res.writeHead(200, {
                        "Content-Type": "text/html"
                    });
                    return FS.createReadStream(manifest.components.html.fsHtmlPath).pipe(res);
                }
            );
        });
    };
}

