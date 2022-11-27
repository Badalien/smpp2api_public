module.exports = {
    status: {
        1: 'ENROUTE',
        2: 'DELIVRD',
        3: 'EXPIRED',
        4: 'DELETED',
        5: 'UNDELIV',
        6: 'ACCEPTD',
        7: 'UNKNOWN',
        8: 'REJECTD',
        9: 'SKIPPED'
    },
    modes: {
        trx: 'bind_transceiver',
        tx: 'bind_transmitter',
        rx: 'bind_receiver'
    },
    commands: {
        sm: 'submit_sm',
        sm_resp: 'submit_sm_resp',
        dlvr: 'deliver_sm',
        dlvr_resp: 'deliver_sm_resp'
    },
    info: {
        vendor_connection: (name) => { return `Session with provider "${name}" was created` },
        vendor_close: (name) => { return `Session with provider "${name}" was closed` },
        client_close: (system_id) => { return `Session with client "${system_id}" was closed` },
        db: 'Connect to db was successful'
    },
    errors: {
        db: 'Database error',
        vendor_connection: 'Connection to vendor error',
        rabbit: 'Connection to rabbit error',
        not_money: 'Not enough money',
        mcc_mnc: 'MCC MNC not found',
        client_price: 'Client price not found',
        dial_peer: 'Dial peer not found',
        vendor: 'Vendor not found',
        vendor_price: 'Vendor price not found',
        bad_delta: 'Bad delta'
    }
};