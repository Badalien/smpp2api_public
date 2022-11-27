<h2> General description </h2>
This project allow to send SMS messages from service with SMPP only support to service with API only support.

<br>

<h2> Modules </h2>
This app has 2 modules:

* SMPP Server - receive messages via smpp, store to beanstalkd tube
* API Sender - read jobs from beanstalkd tube, send messages via API

<br>
<h3> SMPP Server </h3>
This is simple SMPP Server application on node js 

Features:

* crate SMPP server on certail porn and allow to connect from remote services
* receive via via SMPP from SMPP service
* store messages as a jobs to beanstalkd tube (one tube for each API service)
* send DLR statuses via SMPP

Require __nodejs__ version **14.0** or higher
<br>

<h3> API Sender </h3>

This app is a PHP worker which send messages via API to certain API service (let's call them `{transport}`) 

Features:

* sending SMS via API to transport
* store message data (with *message_id* paramert to mysql database)
* receive message statuses via Postback, and update in database

Require __php__ version **7.2** or higher

<br>
<h2> Deployment </h2>


*smpp2api_api-sender*:

congifure supervisor to run worker.php the way like:
php worker.php {transport_name} {id}

where `{transport_name}` is the file in dir smpp2api_api-sender/transports with the configuration of API settings (URL, TOKEN)


*smpp2api_smpp-server*:

add new app in __ecosystem.config.js__ with new TUBE name and new Port for SMPP and transport name (the same as transport_name in previous step)

run `pm2 restart ecosystem.config.js`

<br>
<h2> How to add new transport </h2>

<h3> API Sender </h3>

In general there are 3 steps to add new transport (vendor):
- in directory `transorts` create new file named *vendor_name*.php with constants helping you to send sms via API (API_URL, LOGIN / PASSWORD, etc.) and also beanstalkd details: BEANSTALK TUBE NAME, BEANSTALK HOST;
- in main worker (*worker.php*) add new method which should implement sending sms via API, it should return **message_id** on success or **false** on fail;
- in directory `webhooks` create new file named *vendor_name*.php which should handle delivery callback from vendor and update message status in database (URL will be like: http://{your_server_ip}/webhooks/*vendor_name*.php)
- add new case in *switch* part of function `sendMessage()` in file **worker.php** to call method of new vendor 

<br>
<h3> SMPP Server </h3>

In file `ecosystem.config.js` in section ***apps*** create new app (following the existing examples) with name: "SMPP Server *vendor_name*" and section *env: {}*, what should contain: `SMPP_PORT` (unique port for smpp server), `TUBE` (name of beanstalkd tube), `TRANSPORT` (name of transport) - created on the previous step

<br>
<h2> How to setup transport on the server </h2>

After you push update to GitHub, autometed Github actions will transfer new files to the server.
On the server your should do following steps for install new vendor:

<br>
<h3> API Sender </h3>
Need to add new config for Supervisor
In path `/etc/supervisor/conf.d/` add new file named smpp2api_worker_***vendorname***.conf (you can copy any existed file) and set following parametrs:

[program:smpp2api_worker_***vendorname***] - name of new supervisor program

command=php worker.php *vendorname* `id` - where id is the number of vendor which is running on the current server


<br>
<h3> SMPP Server </h3>

First of all need to allow remote connections to SMPP_PORT in firewall with linux command:

ufw allow from {remote_SMPP_server} to any port `SMPP_PORT`

<br>

Then need to restart `pm2` (node process manager) to activate new app:
- su deployergit
- cd ~/smpp2api/smpp-server/
- pm2 restart ecosystem.config.js
- pm2 save

<br>

You can check if the app starts correctly and listen required port for smpp:

netstat -anlp | grep `SMPP_PORT`

If in output you see LISTEN and app is **node** you can go and try to setup SMPP bind from Mediacore server
