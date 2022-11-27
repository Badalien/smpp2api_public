const smpp = require('smpp');
const config = require('./config');
const strings = require('./strings');
const utils = require('./utils');

const logger = require('./logger').getLogger('server');

var fivebeans = require('fivebeans');
var beans = new fivebeans.client('127.0.0.1', 11300);
// var beans = new fivebeans.client('10.8.0.13', 11300);


var mysql      = require('mysql');
var db = mysql.createConnection({
    host     : '198.199.126.185',
    user     : 'smpp2api_remote',
    password : 'IjogDAvmPHpc',
    database : 'smpptoapi'
});

var smpp_session;
var pdu_queue = [];
var cache = {};

beans.on('connect', function() {
    logger.info('connect to beans open');
    initial();
}).on('error', function(err) {
    logger.error("beans connection failure");
}).on('close', function() {
    logger.info('connect to beans closed');
}).connect();

function initial() {
    smpp.encodings.ASCII.regex = /^[]*$/;

    smpp.createServer((session) => {
        session
            .on('bind_transceiver', (pdu) => onBind(session, pdu, 'TRX'))
            .on('bind_transmitter', (pdu) => onBind(session, pdu, 'TX'))
            .on('bind_receiver', (pdu) => onBind(session, pdu, 'RX'))
            .on('submit_sm', (pdu) => onSubmitMessage(session, pdu))
            .on('enquire_link', (pdu) => session.send(pdu.response()))
            .on('unbind', (pdu) => {
                session.send(pdu.response());
                session.close();
            })    
            .on('error', (error) => {
                logger.error('error');
                logger.error(error);
            })
            .on('close', () => {
                logger.info(session.mode + ': close session');
            });

            smpp_session = session;
        }
    ).listen(process.env.SMPP_PORT);
    
    logger.info('server started');

    setInterval(() => {
        db.query("SELECT * FROM `messages` WHERE `state` <> 'sent' AND `done` = 0 AND `transport` = '" + config.transport + "';", (error, results, fields) => {
            if (error) {
                logger.error(error);
                return;
            }

            var ids = [];
            for (var row of results) {
                sendResult(row);
                ids.push(row.id);
            }

            if (ids.length) {
                var ids_str = ids.join(', ');
                db.query("UPDATE `messages` SET `done` = 1 WHERE `id` IN (" + ids_str + ");");
            }

        });

    }, 5000);
}

function sendResult(row) {
    var state = (row.state == 'delivered') ? 'DELIVRD' : 'UNDELIV';
    var uuid = row.smpp_id;

    var data = {
        esm_class: smpp.ESM_CLASS.MC_DELIVERY_RECEIPT,
        registered_delivery: true,
        short_message: `id:${uuid} sub:001 dlvrd:001 submit date:1590075164 done date:1590075164 stat:${state} err:000 text:1`,
        receipted_message_id: uuid,
        message_state: 2,
    }


    if (smpp_session) {
        smpp_session.deliver_sm(data, () => {
            logger.info('Status sent for message %s: %s', uuid, state);
        });    
    }
}

async function onBind(session, pdu, mode) {
    session.pause();

    session.mode = mode;

    try {
        const auth = await checkAuth(pdu.system_id, pdu.password, session.socket.remoteAddress, mode);
        session.is_binded = true;

        session.send(pdu.response());
        session.resume();

    } catch (e) {
        session.send(pdu.response({
            command_status: smpp.ESME_RBINDFAIL
        }));
        session.close();
    }
}


function onSubmitMessage(session, pdu) {
    utils.smsCounter.count(pdu.short_message.message).then(result => {
        if (result.length > result.per_message) {
            return session.send(pdu.response({'command_status': smpp.ESME_RINVMSGLEN}));
        }

        const uuid = utils.uuid();
        session.send(pdu.response({'message_id': uuid}));
        pdu.uuid = uuid;

        var start_worker = false;
        if (!pdu_queue.length) {
            start_worker = true;
        }

        pdu_queue.push(pdu);

        if (start_worker) {
            logger.info('starting worker');
            worker();
        }

    });
}

function processSubmit(pdu) {

    if (pdu.short_message.udh == undefined) {
        // single
        var msg = prepareMessage(pdu);
        queueMessage(msg);
    } else {
        // multipart
        var udh = parseUdh(pdu.short_message.udh);

        var data;
        if (cache[udh.key] != undefined) {
            data = cache[udh.key];
        } else {
            data = [];
        }
        data.push(pdu);
        cache[udh.key] = data;

        if (data.length == udh.total_parts) {
            var msg = concatMessage(data);
            queueMessage(msg);

            delete cache[udh.key];
        }

    }
}
function parseUdh(udh) {
    var arr = [...udh];
    return {
        message_id: udh[3],
        total_parts: udh[4],
        seq: udh[5],
        key: "message_" + udh[3]
    }
}


function prepareMessage(pdu) {
    return {
        src: pdu.source_addr,
        dst: pdu.destination_addr,
        body: pdu.short_message.message,
        uuid: pdu.uuid
    }
}


function concatMessage(data) {
    var pdu  = data[0];
    var parts = [];
    for (var i in data) {
        var udh = parseUdh(data[i].short_message.udh);
        parts[udh.seq] = data[i].short_message.message;
    }
    return {
        src: pdu.source_addr,
        dst: pdu.destination_addr,
        body: parts.join("")
    }
}


function queueMessage(msg) {
    var json = JSON.stringify(msg);

    beans.use(config.tube, function(err, tubename) {
        beans.put(1, 0, 0, json, function(err, jobid) {
            logger.info("MESSAGE: " + json);
            logger.info("JOB ID: " + jobid)
        });
    });
}


function checkAuth(login, password, ip, mode) {
    return new Promise((resolve, reject) => {
        if (login == config.smppLogin && password == config.smppPassword) {
            logger.info(mode + ': login successfull');
            return resolve(true);
        } else {
            logger.info(mode + ': login failed: ' + login + " / " + password);
            return reject();
        }
    });
}

function worker() {
    var pdu = pdu_queue.shift();

    try {
        processSubmit(pdu);
    } catch(e) {
        logger.error(e);
    }

    if(pdu_queue.length) {
        worker();
    }
}