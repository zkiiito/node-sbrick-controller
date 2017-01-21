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
const fs = require('fs');
const socketLogger = require('./SocketLogger');
const schema = require('./SBrickSchema');

const ajv = new Ajv();

const sessionMiddleware = session({
    secret: 'node-sbrick-controller',
    name: 'SBrickController',
    saveUninitialized: true,
    resave: false
});

const authenticateMiddleware = function (req, res, next) {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    next();
};

storage.initSync({
    dir: __dirname + '/data'
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use('/css', express.static(__dirname + '/public/css'));
app.use('/js-min', express.static(__dirname + '/public/js-min'));
app.use(sessionMiddleware);

io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});

app.get('/', authenticateMiddleware, function (req, res) {
    fs.createReadStream(__dirname + '/public/index.html').pipe(res);
});

app.get('/login', function (req, res) {
    fs.createReadStream(__dirname + '/public/login.html').pipe(res);
});

app.post('/login', function (req, res) {
    const passwd = process.env.passwd || 'adminPass';

    if (req.body.username === 'admin' && req.body.password === passwd) {
        req.session.authenticated = true;
        return res.redirect('/');
    }
    res.redirect('/login');
});

app.get('/logout', authenticateMiddleware, function (req, res) {
    req.session.authenticated = false;
    res.redirect('/login');
});

app.put('/sbricks/:uuid', authenticateMiddleware, function (req, res) {
    if (!ajv.validate(schema, req.body)) {
        res.status(400).send(ajv.errors);
    } else {
        storage.setItem(req.params.uuid, req.body).then(() => {
            res.sendStatus(200);
        });
    }
});

app.get('/sbricks/:uuid/video', authenticateMiddleware, function (req, res) {
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
            sbricks.forEach((sbrick, idx) => {
                if (sbrick.uuid === uuid) {
                    return resolve(sbrick, idx);
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
        }).catch((err) => {
            io.emit('SBrick.error', err);
            io.emit('SBrick.scanResponse', []);
        });
    });

    socket.on('SBrick.connect', (uuid, password) => {
        const sbrick = new SBrick(uuid);
        sbrick.connect().then(() => {
            io.emit('SBrick.connected', uuid);
            sbrick.on('SBrick.voltage', (voltage) => {
                io.emit('SBrick.voltage', uuid, voltage);
            });
            sbrick.on('SBrick.temperature', (temperature) => {
                io.emit('SBrick.temperature', uuid, temperature);
            });
            sbrick.on('SBrick.disconnected', () => {
                io.emit('SBrick.disconnected', uuid);
                findSBrickByUUID(uuid)
                    .then((sbrick, idx) => {
                        sbricks.splice(idx, 1);
                    })
                    .catch(winston.error);
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
        sbricks = [];
    });
});

server.listen(8000);
console.log('Open your browser at http://localhost:8000');
