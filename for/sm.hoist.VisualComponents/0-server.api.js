
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

            var uri = (
                req.state.page &&
                req.state.page.lookup &&
                req.state.page.lookup.path
            ) || req.params[0];

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
                    if (
                        pageContext.page.data.path === "/Index.md" &&
                        req.flags &&
                        req.flags["export.sm.hoist.VisualComponents"] &&
                        req.flags["export.sm.hoist.VisualComponents"]["404onRootPage"]
                    ) {
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


                                var clientContext = pageContext.clientContext || {};
                                if (
                                    req.state.page &&
                                    req.state.page.clientContext
                                ) {
                                    clientContext = LIB._.merge(clientContext, req.state.page.clientContext);
                                }
                                // HACK: Update the hostname and port depending on where asset is being requested from.
                                // TODO: Move this adjustment into a declared plugin so that 'pageContext.clientContext' holds the correct data.
                                if (
                                    req.headers.host &&
                                    clientContext &&
                                    clientContext.page &&
                                    clientContext.page.baseUrl
                                ) {
                                    clientContext.page.baseUrl = clientContext.page.baseUrl.replace(/^(https?:\/\/)([^\/]+)(\/.+)$/, "$1" + req.headers.host + "$3");
                                }


                                // Replace page variables
            					var re = /{{PAGE\.([^}]+)}}/g;
            					var m;
            					var val;
            					while ( (m = re.exec(html)) ) {
            					    val = LIB.traverse.get({
                                        context: clientContext
                                    }, m[1].split("."));
                                    if (typeof val === "object") {
                                        val = encodeURIComponent(JSON.stringify(
                                            val
                                        ));
                                    }
            						html = html.replace(
            						    new RegExp(LIB.RegExp_Escape(m[0]), "g"),
            						    val
            						);
            					}


                                function transform (html) {
                                    if (
                                        !options.transform
                                    ) {
                                        return LIB.Promise.resolve(html);
                                    }
                                    var done = LIB.Promise.resolve();
                                    Object.keys(options.transform).forEach(function (alias) {
                                        done = done.then(function () {
                                            return options.transform[alias](html).then(function (_html) {
                                                html = _html
                                            });
                                        });
                                    });
                                    return done.then(function () {
                                        return html;
                                    });
                                }


                                return transform(html).then(function (html) {

    
                                    // Re-base all links, style and script paths.
                                    // TODO: Add option to 'sm.hoist.VisualComponents' to insert variables
                                    //       so we can prefix everything by replacing one variable.
                                    var re = /(<a.+?href="|<img.+?src="|<script.+?src="|<link.+?href=")(\/[^"]*)/g;
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
                                    return;
                                }).catch(next);
                            });
                        }
                    );
                });
            }).catch(next);
        };
    }

    return exports;
}
