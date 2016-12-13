const SBrick = require('sbrick-protocol');
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser');
const session = require('express-session');
const storage = require('node-persist');
const async = require('async');
const Ajv = require('ajv');
const request = require('request');
const winston = require('winston');
const socketLogger = require('./SocketLogger');
const schema = require('./SBrickSchema');

const ajv = new Ajv();

const sessionMiddleware = session({
    secret: 'node-sbrick-controller',
    name: 'SBrickController',
    saveUninitialized: true,
    resave: false
});

storage.initSync({
    dir: __dirname + '/data'
});

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));
app.use(sessionMiddleware);

io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});

app.get('/login', function (req, res) {
    //TODO login page
    req.session.authenticated = true;
    res.redirect('/');
});

app.post('/login', function (req, res) {
    //TODO validate data, set session
});

app.put('/sbricks/:uuid', function (req, res) {
    if (req.session.authenticated === undefined) {
        return res.sendStatus(401);
    }

    if (!ajv.validate(schema, req.body)) {
        res.status(400).send(ajv.errors);
    } else {
        storage.setItem(req.params.uuid, req.body).then(() => {
            res.sendStatus(200);
        });
    }
});

app.get('/sbricks/:uuid/video', function (req, res) {
    if (req.session.authenticated === undefined) {
        return res.sendStatus(401);
    }

    storage.getItem(req.params.uuid)
        .then((value) => {
            if (value) {
                if (value.streamUrl) {
                    request
                        .get(value.streamUrl)
                        .on('error', function (err) {
                            winston.error(err);
                        })
                        .pipe(res);
                } else {
                    res.status(400).send('no stream url found');
                }
            } else {
                res.sendStatus(404);
            }
        })
        .catch((err) => {
            winston.error(err);
            res.send(err);
        });
});

io.on('connection', function (socket) {
    if (socket.request.session.authenticated === undefined) {
        return socket.disconnect();
    }

    winston.add(socketLogger, {socket: socket});

    let sbricks = [];

    const findSBrickByUUID = function (uuid) {
        return new Promise((resolve, reject) => {
            sbricks.forEach((sbrick) => {
                if (sbrick.uuid === uuid) {
                    return resolve(sbrick);
                }
            });
            reject('not found');
        });
    };

    socket.on('SBrick.scan', () => {
        sbricks.forEach((sbrick) => {
            sbrick.disconnect();
        });

        SBrick.scanSBricks().then((sbricks) => {
            async.map(sbricks, (sbrick, callback) => {
                storage.getItem(sbrick.uuid).then((value) => {
                    callback(null, Object.assign({}, value, sbrick));
                });
            }, (err, results) => {
                io.emit('SBrick.scanResponse', results);
            });
        });
    });

    socket.on('SBrick.connect', (uuid, password) => {
        const sbrick = new SBrick(uuid);
        sbrick.connect().then(() => {
            io.emit('SBrick.connected', uuid);
            sbrick.on('SBrick.voltAndTemp', (voltage, temperature) => {
                io.emit('SBrick.voltAndTemp', uuid, voltage, temperature);
            });
            sbrick.on('SBrick.disconnected', () => {
                io.emit('SBrick.disconnected', uuid);
            });

            return sbrick.start(password);
        }).catch((err) => {
            io.emit('SBrick.error', uuid, err);
            sbrick.disconnect();
        });
        sbricks.push(sbrick);
    });

    socket.on('SBrick.controlChannel', (uuid, channel, pwm) => {
        findSBrickByUUID(uuid)
            .then((sbrick) => {
                sbrick.channels[channel].pwm = pwm;
            })
            .catch(winston.error);
    });

    socket.on('SBrick.disconnect', (uuid) => {
        findSBrickByUUID(uuid)
            .then((sbrick) => {
                sbrick.disconnect();
            })
            .catch(winston.error);
    });

    socket.on('SBrick.command', (uuid, command, args) => {
        winston.info(uuid, command, args);
        findSBrickByUUID(uuid)
            .then((sbrick) => {
                if (typeof sbrick[command] === 'function') {
                    sbrick[command].apply(sbrick, args).then(winston.info).catch(winston.warn);
                }
            })
            .catch(winston.error);
    });

    socket.on('disconnect', () => {
        winston.remove(socketLogger);
        sbricks.forEach((sbrick) => {
            sbrick.disconnect();
        });
    });
});

server.listen(8000);
console.log('Open your browser at http://localhost:8000');
