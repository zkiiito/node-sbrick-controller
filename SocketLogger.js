const Transport = require('winston-transport');

module.exports = class CustomTransport extends Transport {
    constructor(opts) {
        super(opts);
        this.socket = null;
    }

    log(info, callback) {
        if (this.socket) {
            this.socket.emit('log', info.level, info.message);
        }
        callback();
    }

    setSocket(socket) {
        this.socket = socket;
    }
};
