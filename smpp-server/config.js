module.exports = {
    smppHost: '127.0.0.1',
    tube: process.env.TUBE,
    // tube: 'incoming_messages',
    transport: process.env.TRANSPORT,
    smppLogin: '{smpp_login}', 
    smppPassword: '{smpp_password}' // max 8 digits
};