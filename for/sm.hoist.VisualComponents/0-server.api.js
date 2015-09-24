
const PATH = require("path");
const FS = require("fs");
const URL = require("url");
const ESCAPE_REGEXP_COMPONENT = require("escape-regexp-component");

exports.forLib = function (LIB) {

    const EXPORT = require("./export").forLib(LIB);

    var exports = {};

    exports.app = function (options) {

        var context = options.context();
    
        return function (req, res, next) {

            var uri = req.params[0];
            
            return LIB.Promise.all([
                context.getAdapterAPI("page"),
                context.getAdapterAPI("boundary")
            ]).spread(function (page, boundary) {

                return page.contextForUri(
                    uri
                ).then(function (pageContext) {
    
                    if (!pageContext) {
                        res.writeHead(404);
                        return res.end("Not Found");
                    }
    
                    var baseUrlParts = URL.parse(pageContext.skin.host.baseUrl);
                    var configOverrides = {};
                    LIB._.merge(configOverrides, options.config);
                    LIB._.merge(configOverrides, {
                        "source": {
                            "server": {
                                "host": baseUrlParts.host,
                                "subPath": baseUrlParts.path.replace(/^\/$/, "") + options.sourceBaseSubUrl,
                                "headers": {
                                    "X-Boundary-Bypass-Token": boundary.bypassToken
                                }
                            }
                        }
                    });
    
                    return EXPORT.parseForUri(
                        pageContext.skin.data.componentsPath,
                        pageContext.skin.host.path,
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
    
                            //return FS.createReadStream(manifest.components.html.fsHtmlPath).pipe(res);
                            // TODO: Do this via output rewrite middleware
                            return FS.readFile(manifest.components.html.fsHtmlPath, "utf8", function (err, html) {
                                if (err) return next(err);
    
    
                                html = html.replace(/\{\{PAGE\.context\}\}/g, encodeURIComponent(JSON.stringify(
                                    pageContext.clientContext || {}
                                )));
    
                                // Re-base all style and script paths.
                                // TODO: Add option to 'sm.hoist.VisualComponents' to insert variables
                                //       so we can prefix everything by replacing one variable.
                                var re = /(<script.+?src="|<link.+?href=")(\/[^"]+)/g;
                                var m = null;
                                var replace = {};
                                var baseSubPath = URL.parse(pageContext.page.host.baseUrl).pathname.replace(/\/$/, "");
                                while ( (m = re.exec(html)) ) {
                                    if (m[2].substring(0, baseSubPath.length + 1) === baseSubPath + "/") {
                                        // Path is already adjusted.
                                    } else {
                                        replace[m[0]] = m;
                                    }
                                }
    
                                Object.keys(replace).forEach(function (key) {
                                    html = html.replace(
                                        new RegExp(LIB.RegExp_Escape(replace[key][0]), "g"),
                                        replace[key][1] + baseSubPath + replace[key][2]
                                    );
                                });
    
                                res.writeHead(200, {
                                    "Content-Type": "text/html"
                                });
                                res.end(html);
                                return html;
                            });
                        }
                    );
                });
            }).catch(next);
        };
    }

    return exports;
}
