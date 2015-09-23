
exports.forLib = function (LIB) {
    var ccjson = this;

	const WEBPACK = require("webpack");
    const WEBPACK_APP = require("webpack-dev-middleware");

//    const SERVER = require("./0-server.api").forLib(LIB);

    return LIB.Promise.resolve({
        forConfig: function (defaultConfig) {

            var Entity = function (instanceConfig) {
                var self = this;

                self.AspectInstance = function (aspectConfig) {

                    var config = {};
                    LIB._.merge(config, defaultConfig);
                    LIB._.merge(config, instanceConfig);
                    LIB._.merge(config, aspectConfig);

                    return LIB.Promise.resolve({
                        app: function () {

                            return LIB.Promise.resolve(
                                ccjson.makeDetachedFunction(
                                    function (req, res, next) {

//console.log("config", config);
                                        var compilerConfig = {
                            				debug: true,
                            				bail: true,
                            				resolveLoader: {
                            				    "alias": {
                                				    "chscript": LIB.path.dirname(require.resolve('../../../../lib/html2chscript-for-webpack/package.json')),
                                				    "raw": LIB.path.dirname(require.resolve('raw-loader/package.json'))
                            				    }
                            				},
                            				context: config.basePath,
                            				module: {
                            					loaders: [
/*
                            						{
                            							_alias: "css",
                            							test: /\.css$/,
                            							loaders: [
                            								"style-loader",
                            								"css-loader"
                            							]
                            						},
                            						{
                            							_alias: "less",
                            							test: /\.less$/,
                            							loaders: [
                            								"style",
                            								"css",
                            								"less"
                            							]
                            						},
*/
                            						{
                            							test: /\.chscript\.htm$/,
                            							loader: LIB.path.dirname(require.resolve('../../../../lib/html2chscript-for-webpack/package.json'))
                            						}
                            					]
                            				},
                            				plugins: [
                            					new WEBPACK.optimize.DedupePlugin(),
                            					new WEBPACK.NoErrorsPlugin()
                            				],
                            			    externals: {},
                            				entry: {
                            					app: [
                            					    "." + req.params[0]
                            					]
                            				},
                            				output: {
                            					path: config.distPath,
                            					publicPath: "/",
                            					filename: "." + req.params[0]
                            				}
                            			};
                            
//console.log("compilerConfig", JSON.stringify(compilerConfig, null, 4));


                                        // @see https://github.com/webpack/webpack-dev-middleware
                                        var app = WEBPACK_APP(WEBPACK(compilerConfig), {

                                            noInfo: false,
                                            // display no info to console (only warnings and errors)
                                        
                                            quiet: false,
                                            // display nothing to the console
                                        
                                            lazy: true,
                                            // switch into lazy mode
                                            // that means no watching, but recompilation on every request

                                            publicPath: "/",
                                            // public path to bind the middleware to
                                            // use the same as in webpack

                                            stats: {
                                                colors: true
                                            }
                                        });

                                        req.url = req.params[0];
                                        return app(req, res, function (err) {
                                            if (err) {
                                                console.error("Error while packing:", err.stack);
                                                res.writeHead(500);
                                                res.end("Internal Server Error");
                                                return;
                                            }
                                            res.writeHead(404);
                                            res.end("Not Found: by webpack config");
                                            return;
                                        });
                                    }
                                )
                            );
                        }
                    });
                }
            }
            Entity.prototype.config = defaultConfig;

            return Entity;
        }
    });
}
