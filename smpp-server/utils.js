const strings = require('./strings');

const uuid = function () {
    let uuid = '', ii;
    for (ii = 0; ii < 32; ii += 1) {
        switch (ii) {
            case 8:
            case 20:
                uuid += '-';
                uuid += (Math.random() * 16 | 0).toString(16);
                break;
            case 12:
                uuid += '-';
                uuid += '4';
                break;
            case 16:
                uuid += '-';
                uuid += (Math.random() * 4 | 8).toString(16);
                break;
            default:
                uuid += (Math.random() * 16 | 0).toString(16);
        }
    }
    return uuid;
};

function twoDigits(d) {
    if(0 <= d && d < 10) return "0" + d.toString();
    if(-10 < d && d < 0) return "-0" + (-1*d).toString();
    return d.toString();
}

const dateToMysqlFormat = function(date) {
    return date.getUTCFullYear() + "-" + twoDigits(1 + date.getUTCMonth()) + "-" + twoDigits(date.getUTCDate()) + " " + twoDigits(date.getHours()) + ":" + twoDigits(date.getUTCMinutes()) + ":" + twoDigits(date.getUTCSeconds());
};

const smsCounter = function () {};

smsCounter.gsm7bitChars = "@£$¥èéùìòÇ\\nØø\\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\\\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

smsCounter.gsm7bitExChar = "\\^{}\\\\\\[~\\]|€";

smsCounter.gsm7bitRegExp = RegExp("^[" + smsCounter.gsm7bitChars + "]*$");

smsCounter.gsm7bitExRegExp = RegExp("^[" + smsCounter.gsm7bitChars + smsCounter.gsm7bitExChar + "]*$");

smsCounter.gsm7bitExOnlyRegExp = RegExp("^[\\" + smsCounter.gsm7bitExChar + "]*$");

smsCounter.GSM_7BIT = 'GSM_7BIT';

smsCounter.GSM_7BIT_EX = 'GSM_7BIT_EX';

smsCounter.UTF16 = 'UTF16';

smsCounter.messageLength = {
    GSM_7BIT: 160,
    GSM_7BIT_EX: 160,
    UTF16: 70
};

smsCounter.multiMessageLength = {
    GSM_7BIT: 153,
    GSM_7BIT_EX: 153,
    UTF16: 67
};

smsCounter.count = function(text) {
    return new Promise(resolve => {
        let encoding, length, messages, per_message, remaining;
        encoding = this.detectEncoding(text);
        length = text.length;
        if (encoding === this.GSM_7BIT_EX) {
            length += this.countGsm7bitEx(text);
        }
        per_message = this.messageLength[encoding];
        if (length > per_message) {
            per_message = this.multiMessageLength[encoding];
        }
        messages = Math.ceil(length / per_message);
        remaining = (per_message * messages) - length;
        if(remaining === 0 && messages === 0){
            remaining = per_message;
        }
        resolve({
            encoding: encoding,
            length: length,
            per_message: per_message,
            remaining: remaining,
            messages: messages
        });
    });

};

smsCounter.detectEncoding = function(text) {
    switch (false) {
        case text.match(this.gsm7bitRegExp) == null:
            return this.GSM_7BIT;
        case text.match(this.gsm7bitExRegExp) == null:
            return this.GSM_7BIT_EX;
        default:
            return this.UTF16;
    }
};

smsCounter.countGsm7bitEx = function(text) {
    let char2, chars;
    chars = (function() {
        let _i, _len, _results;
        _results = [];
        for (_i = 0, _len = text.length; _i < _len; _i++) {
            char2 = text[_i];
            if (char2.match(this.gsm7bitExOnlyRegExp) != null) {
                _results.push(char2);
            }
        }
        return _results;
    }).call(this);
    return chars.length;
};

function getMessageState(state) {
    return Object.keys(strings.status).find(key => strings.status[key] === state) || 7;
}

module.exports = {
    uuid: uuid,
    dateToMysqlFormat: dateToMysqlFormat,
    smsCounter: smsCounter,
    getMessageState: getMessageState
};