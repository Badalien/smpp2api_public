<?php

include "vendor/autoload.php";
use Pheanstalk\Pheanstalk;

$transport = $argv[1] ?? "main";
include "transports/{$transport}.php";
include "db.php";

$worker_id = $argv[2] ?? 0;
$pheanstalk = Pheanstalk::create(BEANSTALK_HOST);
$parent_dir = dirname(dirname(__FILE__));
$log_path = $parent_dir . "/logs/sender_{$transport}.log";

$fail_counter = 0;
$sleep_counter = 0;

while (true) {
    $job = $pheanstalk->watch(BEANSTALK_TUBE)->ignore('default')->reserve();
    if (!$job) {
        _log('No jobs');
        sleep(10);
        continue;
    }

    $data = $job->getData();
    // _log($data);
    $payload = json_decode($data, true);

    $pheanstalk->delete($job);
    $result = sendMessage($payload['uuid'], $payload['dst'], $payload['body'], $payload['src']);
    
    if ($result) {
        $fail_counter = 0;
        $sleep_counter = 0;
        // $pheanstalk->delete($job);
    } else {
        $fail_counter++;
        $sleep_counter++;

        if ($sleep_counter > 10) {
            _log("Restarting daemon...");
            die();
        }
        // $pheanstalk->release($job);

        $sleep = $fail_counter * $fail_counter * 2;
        _log("Sending failed $fail_counter time(s), wait $sleep sec.");
        sleep($sleep);
    }
}

function sendMessage($smpp_id, $phone, $message, $sender_id) {
    global $db;
    global $transport;
    $created_at = date('Y-m-d H:i:s');

    _log("Sending message \"$message\" to $phone with transport $transport");

    // sending message and get remote message_id
    switch($transport) {
        case 'example':
            $message_id = sendMessageExample($phone, $message, $sender_id);
            break;
    }


    // save sent message with id to database
    if ($message_id) {
        _log("Success with id $message_id");
        $query = "INSERT INTO `messages` (`created_at`, `smpp_id`, `message_id`, `state`, `transport`, `sender_id`, `number`, `body`) VALUES ('{$created_at}', '{$smpp_id}', '{$message_id}', 'sent', '{$transport}', '{$sender_id}', '{$phone}', '${message}');";
        _log($query);
        $res = $db->query($query);
        if (!$res) _log("MYSQL ERROR: " . $db->error);
        return true;
    } else {
        $query = "INSERT INTO `messages` (`created_at`, `smpp_id`, `message_id`, `state`, `transport`, `sender_id`, `number`, `body`) VALUES ('{$created_at}', '{$smpp_id}', null, 'failed', '{$transport}', '{$sender_id}', '{$phone}', '${message}');";
        _log($query);
        $res = $db->query($query);
        if (!$res) _log("MYSQL ERROR: " . $db->error);
        return false;
    }
}


// function by certain transport
// to add new vednor you should write method to send message to vendor which return message_id on success or false on fail
function sendMessageExample($phone, $message, $sender_id) {
    global $transport;

    $post_header = [
        'Authorization: Bearer ' . API_KEY,
        'Content-Type: application/json'
    ];

    $post_data =  json_encode([
        'to' => $phone,
        'message' => $message,
        'sender_id' => $sender_id
        // 'priority' => 1,
    ]);


    $curl = curl_init();

    curl_setopt($curl, CURLOPT_URL, API_URL);
    curl_setopt($curl, CURLOPT_USERAGENT, "Opera/9.80 (Windows NT 6.1; U; en) Presto/2.5.24 Version/10.54");
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, TRUE);
    curl_setopt($curl, CURLOPT_POST, TRUE);
    curl_setopt($curl, CURLOPT_HTTPHEADER, $post_header);
    curl_setopt($curl, CURLOPT_POSTFIELDS, $post_data);
    curl_setopt($curl, CURLOPT_FOLLOWLOCATION, TRUE);

    $response = curl_exec($curl);

    $code = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    if ($code != 200) {
        _log("Failed on transport `$transport` with response code $code");
        return false;
    }

    curl_close($curl);
    
    _log("Response from `$transport`: $response");
    $decoded = json_decode($response, true);

    if ($decoded && $decoded['success']) {
        return $decoded['message_id'] ?? false;
    } else {
        _log("Failed on transport `$transport` with wrong response: $response");
        return false;
    }
}


function _log($msg) {
    global $worker_id;
    global $transport;
    global $log_path;

    $date = date("Y-m-d H:i:s");
    $str = "[{$transport}:{$worker_id}] [$date] $msg\n";
    file_put_contents("$log_path", $str, FILE_APPEND);
    // echo $str;
}
