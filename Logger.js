const { createLogger, transports } = require('winston');
const SocketLogger = require('./SocketLogger');
const socketLogger = new SocketLogger();
const logform = require('logform');
const { combine, timestamp, printf } = logform.format;

module.exports.winston = createLogger({
    format: combine(
        timestamp(),
        printf(nfo => {
            return `${nfo.timestamp} ${nfo.level}: ${nfo.message}`;
        })
    ),
    transports: [new transports.Console(), socketLogger]
});

module.exports.socketLogger = socketLogger;
