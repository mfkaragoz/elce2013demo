var net = require('net');

/* DEVICE SETTINGS */
var devices = [];

var HOST = '127.0.0.1';
var PORT = 1338;


/* UDP SERVER */
var dgram = require("dgram");
var udp_server = dgram.createSocket("udp4");
udp_server.on("error", function (err) {
  console.log("server error:\n" + err.stack);
  server.close();
});

udp_server.on("message", function (msg, rinfo) {	//rinfo Object. Remote address information
    var device_info = JSON.parse(msg);
    for(var i = 0; i < devices.length; i++){
        if(devices[i].device_id === device_info.device_id){	//if device is found, update and notify WEB clients
            devices[i].status = device_info.status;
            devices[i].location = device_info.location;
            devices[i].vid_src = device_info.vid_src;
            devices[i].md_mode = device_info.md_mode;
            devices[i].time = device_info.time;
            
            updateCamBySocket(devices[i]);          
            break;
        }
    }
    if(i === devices.length){								//no device is found; add to list
        devices[i] = {};
        devices[i].device_id = device_info.device_id;       devices[i].status = device_info.status;
        devices[i].location = device_info.location; 	    devices[i].vid_src = device_info.vid_src;
        devices[i].md_mode = device_info.md_mode;	        devices[i].time = device_info.time;
        devices[i].ip = rinfo.address;
        /* TCP CLIENT */
        devices[i].client = new net.Socket();	//create socket (TCP client) to connect new device
        devices[i].client.connect(PORT, devices[i].ip, function() {
            console.log('CONNECTED TO: ' + devices[i].ip + ':' + PORT);
            sendNewCamBySocket(devices[i]);
        });
        devices[i].client.on('data', function(data) {	// Add a 'data' event handler for the client socket
            var alarm_data = JSON.parse(data);			// data is what the server sent to this socket
            console.log('Alarm from ' + alarm_data.camera_id);
            sendAlarmBySocket(alarm_data);
        });
        devices[i].client.on('close', function() {		// Add a 'close' event handler for the client socket
            sendDropCamBySocket(devices[i].device_id);
            devices.splice(i,1);
            console.log('Connection closed');
        });
        devices[i].client.on('error', function() {		// Add a 'error' event handler for the client socket
            console.log('Connection error');
        });
    }
});

udp_server.on("listening", function () {
  var address = udp_server.address();
  console.log("UDP server listening " +
      address.address + ":" + address.port);
});
udp_server.bind(1400);


/* CONF MESSAGE FUNCTIONS */
function sendDeviceConf(socket, dev_id, vid_src, md_mode){
    var msg = new Buffer([dev_id, vid_src, md_mode]);
    socket.write(msg);
    console.log('Configuration sent!');
}

/* WEBSERVER */
var express = require('express');
var app = express();
var webserver = require('http').createServer(app);
var io = require('socket.io').listen(webserver);
 
io.configure(function(){
  io.enable('browser client etag');
  io.set('log level', 1);

  io.set('transports', [
    'websocket',
    'flashsocket',
    'htmlfile',
    'xhr-polling',
    'jsonp-polling'
  ]);
});
  
app.configure(function(){
  app.use(express.static(__dirname + '/static/app'));
});

webserver.listen(3000);
console.log("Webserver listening 3000");


/* WEBSOCKET */
var websockets = [];

io.sockets.on('connection', function (socket) {
  console.log('Client Connected!!!');
  
  socket.on('getDeviceList', function (data) {
    sendDeviceList(socket);
  });

  socket.on('config', function (data) {
    var device = findDevice(devices, data.device_id);
    sendDeviceConf(device.client, device.device_id, data.vid_src, data.md_mode);
  });
  
  websockets.push(socket);
});

function sendDeviceList(socket){
  if(devices.length > 0){
    for(var i=0; i<devices.length; i++){
        socket.emit('caminfo', {device_id: devices[i].device_id, status: devices[i].status, location: devices[i].location, vid_src: devices[i].vid_src, md_mode: devices[i].md_mode, time: devices[i].time, ip:devices[i].ip});
    }
  }
}

function sendAlarmBySocket(alarm_data){
    if(websockets.length > 0){
        for(var i=0; i<websockets.length; i++){
            websockets[i].emit('alarm', {alarm: alarm_data});
        }
    }
}

function sendNewCamBySocket(device){
    if(websockets.length > 0){
        for(var i=0; i<websockets.length; i++){
            websockets[i].emit('newcam', {device_id: device.device_id, status: device.status, location: device.location, vid_src: device.vid_src, md_mode: device.md_mode, time: device.time, ip:device.ip});
        }
    }
}

function updateCamBySocket(device){
    if(websockets.length > 0){
        for(var i=0; i<websockets.length; i++){
            websockets[i].emit('updatecam', {device_id: device.device_id, status: device.status, location: device.location, vid_src: device.vid_src, md_mode: device.md_mode, time: device.time, ip:device.ip});
        }
    }
}

function sendDropCamBySocket(device_id){
    if(websockets.length > 0){
        for(var i=0; i<websockets.length; i++){
            websockets[i].emit('dropcam', {device_id: device_id});
        }
    }
}


/* SYNC FUNCTIONS */
function findDevice(devices, id){
    var device = {};
    for(var i=0; i<devices.length; i++){
        if(devices[i].device_id === id){
            device = devices[i];
            break;
        }
    }
    return device;
}



/* TEST CODE */
/*
setInterval(function(){
    for(var i = 0; i < devices.length; i++){
        if(devices[i].client != null){
            sendDeviceConf(devices[i].client, devices[i].device_id, 2, 1);
        }
    }
}, 5000);
*/

