const smpp = require('smpp');
const config = require('./config');
const strings = require('./strings');
const utils = require('./utils');

const logger = require('./logger').getLogger('test')

var fivebeans = require('fivebeans');
var beans = new fivebeans.client('127.0.0.1', 11300);

var pdu_queue = [];
var cache = {};

// beans.on('connect', function() {
//     initial();
// }).on('error', function(err) {
//     logger.error("beans connection failure");
// }).connect();
initial();

function initial() {
    smpp.encodings.ASCII.regex = /^[]*$/;

    smpp.createServer((session) =>
        session
            .on('bind_transceiver', (pdu) => onBind(session, pdu, 'TRX'))
            .on('bind_transmitter', (pdu) => onBind(session, pdu, 'TX'))
            .on('bind_receiver', (pdu) => onBind(session, pdu, 'RX'))
            .on('submit_sm', (pdu) => onSubmitMessage(session, pdu))
            .on('deliver_sm_resp', (pdu) => (session, pdu) => {
                logger.info("DELIVER_SM_RESP");
                logger.info(pdu);
            })
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
            })
    ).listen(process.env.SMPP_PORT);

    logger.info('server started');
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

        var start_worker = false;
        if (!pdu_queue.length) {
            start_worker = true;
        }

        pdu.uuid = uuid;
        pdu_queue.push(pdu);

        if (start_worker) {
            logger.info('starting worker');
            worker();
        }

        logger.info(pdu);

        setTimeout(() => {
            try {

                var data = {
                    // source_addr: pdu.destination_addr,
                    // source_addr_ton: pdu.dest_addr_ton,
                    // source_addr_npi: pdu.dest_addr_npi,
                    // destination_addr: pdu.source_addr,
                    // dest_addr_ton: pdu.source_addr_ton,
                    // dest_addr_npi: pdu.source_addr_npi,
                    esm_class: smpp.ESM_CLASS.MC_DELIVERY_RECEIPT,
                    registered_delivery: true,
                    // short_message: `id:${uuid} sub:001 dlvrd:001 submit date:1590075164 done date:1590075164 stat:UNDELIV err:000 text:1`,
                    short_message: `id:${uuid} sub:001 dlvrd:001 submit date:1590075164 done date:1590075164 stat:DELIVRD err:000 text:1`,
                    receipted_message_id: uuid,
                    message_state: 2,
                }

                logger.info('DELIVER_SM for message %s', uuid);
                logger.info(data);
                // session.send(new smpp.PDU('deliver_sm', data));

                session.deliver_sm(data, () => {
                    logger.info('deliver_sm sent');
                });

            } catch (e) {
                console.log(e);
            }
        }, 5000);


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
        body: pdu.short_message.message
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
    logger.info("DEBUG Queue messsage: " + json);
    return;

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