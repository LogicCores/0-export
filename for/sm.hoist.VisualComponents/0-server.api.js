
const PATH = require("path");
const FS = require("fs");
const URL = require("url");
const ESCAPE_REGEXP_COMPONENT = require("escape-regexp-component");

exports.forLib = function (LIB) {

    const EXPORT = require("./export").forLib(LIB);

    var exports = {};

    exports.app = function (options) {
    
        return function (req, res, next) {

            var uri = req.params[0];
            var htmRequested = /\.html?$/.test(uri);

            return req.context.page.skinContextForUri(
                uri
            ).then(function (skinContext) {
    
                if (htmRequested) {
    
                    // The route was requested with the 'htm' extension so we serve
                    // the raw file instead of the componentifed file.
                    // TODO: Remove this option and return 404 in production.
    
                    // We convert the namespaced 'component' attributes as jQuery has a hard
                    // time selcting attributes with colons in it. Likely true for many other
                    // parsers as well.
                    if (/;convert-to-data;/.test(req.headers["x-component-namespace"] || "")) {
                        return FS.readFile(skinContext.skin.data.path, "utf8", function (err, html) {
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
    
                    return FS.createReadStream(skinContext.skin.data.path).pipe(res);
                }

                var baseUrlParts = URL.parse(skinContext.skin.host.baseUrl);
                var configOverrides = {};
                LIB._.merge(configOverrides, options.config);
                LIB._.merge(configOverrides, {
                    "source": {
                        "server": {
                            "host": baseUrlParts.host,
                            "subPath": baseUrlParts.path
                        }
                    }
                });

                return EXPORT.parseForUri(
                    skinContext.skin.data.componentsPath,
                    skinContext.skin.host.path,
                    configOverrides,
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
            }).catch(next);
        };
    }

    return exports;
}
