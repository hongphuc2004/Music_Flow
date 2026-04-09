// Bootstrap the main API server so accidental `node server.js` still starts
// the same backend as the npm scripts.
require("./src/server");
