const winston = require('winston');
const util = require('util');

const SocketLogger = function (options) {
    this.name = 'SocketLogger';
    this.level = options.level || 'info';
    this.socket = options.socket;
};

util.inherits(SocketLogger, winston.Transport);

SocketLogger.prototype.log = function (level, message, metadata, callback) {
    this.socket.emit('log', level, message);

    if (callback) {
        callback(null, true);
    }
};

module.exports = SocketLogger;