const smpp = require('smpp');
const config = require('./config');
const strings = require('./strings');
const utils = require('./utils');

const logger = require('./logger').getLogger('test');

var smpp_session;
var pdu_queue = [];

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
  ).listen(2775);
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

initial();
