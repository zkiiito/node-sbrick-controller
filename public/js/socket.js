/*global io, app */
var Socket = {
    initialize: function () {
        this.socket = io.connect(document.location.href);

        this.socket.on('SBrick.scanResponse', this.scanResponse);
        this.socket.on('SBrick.connected', this.connected);
        this.socket.on('SBrick.disconnected', this.disconnected);
        this.socket.on('SBrick.error', this.error);
        this.socket.on('SBrick.voltAndTemp', this.voltAndTemp);
        this.socket.on('SBrick.voltage', this.voltage);
        this.socket.on('SBrick.temperature', this.temperature);
        this.socket.on('connect', this.scan.bind(this));
        this.socket.on('disconnect', this.disconnectedFromServer);
        this.socket.on('log', this.log);
    },

    scan: function () {
        this.socket.emit('SBrick.scan');
    },

    scanResponse: function (sbricks) {
        app.scanResponse(sbricks);
    },

    connect: function (uuid, password) {
        this.socket.emit('SBrick.connect', uuid, password);
    },

    connected: function (uuid) {
        app.connected(uuid);
    },

    disconnect: function (uuid) {
        this.socket.emit('SBrick.disconnect', uuid);
    },

    disconnected: function (uuid) {
        app.disconnected(uuid);
    },

    controlChannel: function (uuid, channelId, pwd) {
        this.socket.emit('SBrick.controlChannel', uuid, channelId, pwd);
    },

    error: function (uuid, err) {
        app.error(uuid, err);
    },

    voltAndTemp: function (uuid, voltage, temperature) {
        app.voltage(uuid, voltage);
        app.temperature(uuid, temperature);
    },

    voltage: function (uuid, voltage) {
        app.voltage(uuid, voltage);
    },

    temperature: function (uuid, temperature) {
        app.temperature(uuid, temperature);
    },

    disconnectedFromServer: function () {
        app.disconnectedFromServer();
    },

    log: function (level, message) {
        console.log(level, message);
    }
};