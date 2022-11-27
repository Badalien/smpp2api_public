const log4js = require('log4js');
var path = require('path');
const logFile = path.dirname(__dirname) + '/logs/server.log';

log4js.configure({
    appenders: {
        out: { type: 'stdout' },
        server: {type: 'file', filename: logFile},
        test: {type: 'file', filename: logFile}
    },
    categories: {
        default: {appenders: ['out'], level: 'debug'},
        server: { appenders: ['server'], level: 'info' },
        test: { appenders: ['test'], level: 'trace' }
    }
});

module.exports = log4js;