var net = require('net');
var exec = require('child_process').exec;

/* DEVICE SETTINGS */
var device = {id: 123, tcp_socket: null};

/* VIDEO APP MESSAGE CODES */
var VIDEO_SRC_OPCODE = 0x01;
var VIDEO_MODE_OPCODE = 0x02;
var VIDEO_ALARM_OPCODE = 0x03;

/* VIDEO APP MESSAGE FUNCTIONS */
function setVideoSrc(socket, src){
    var msg = new Buffer([VIDEO_SRC_OPCODE, src]);
    socket.write(msg);
}

function setMdMode(socket, mode){
    var msg = new Buffer([VIDEO_MODE_OPCODE, mode]);
    socket.write(msg);
}

/* ALARM SENDER */
function sendAlarm(socket, type){
    var msg = {camera_id: device.id, type: type, time: Date.now()};
    socket.write(JSON.stringify(msg));
}


/* VIDEO APP TCP SERVER STARTS: TCP Connection between Video App and Camera System App (IPC) */
var video = {video_src: 1, md_mode: 0, socket: null};
var video_app_server = net.createServer(function (socket) { //'connection' listener
  console.log('Video app connected');
    socket.on('data', function(data){	//Emitted when data is received
    if(data.length === 2){
        if(data[0] === VIDEO_SRC_OPCODE){	//ACK taken from VideoApp
            console.log('Video source message received! Source: ' + data[1]);
            video.video_src = data[1];		//Save state
        }
        else if(data[0] === VIDEO_MODE_OPCODE){
            console.log('Video mode message received! Mode: ' + data[1]);
            video.md_mode = data[1];
        }
        else if(data[0] === VIDEO_ALARM_OPCODE){	//Alarm taken from VideoApp
            console.log('Alarm message received!');
            if(device.tcp_socket != null){
                sendAlarm(device.tcp_socket, data[1]);	//Send alarm to Server
            }
        }
        else{
            console.log('Undefined message received!');
        }
    }
  });
  socket.on('close', function(){	//Emitted once the socket is fully closed
        video.socket = null;
  });
  video.socket = socket;	//save socket
});

video_app_server.listen(1337, '127.0.0.1');
console.log('Video app server listening to 127.0.0.1:1337');
/* VIDEO APP TCP SERVER ENDS */


/* SYSTEM TCP SERVER STARTS: TCP Connection between Camera System App and Server */
function setVideoSrc(socket, src){
    var msg = new Buffer([VIDEO_SRC_OPCODE, src]);
    socket.write(msg);
}
function setMdMode(socket, mode){
    var msg = new Buffer([VIDEO_MODE_OPCODE, mode]);
    socket.write(msg);
}

var system_server = net.createServer(function (socket) {
  console.log('Server app connected');
  socket.on('data', function(data){
    if(data.length === 3 && data[0] === device.id){
        console.log('Conf Received!');
        if(video.socket != null){
            setVideoSrc(video.socket, data[1]);	//Send configuration to VideoApp
            setMdMode(video.socket, data[2]);
        }
     }
  });
  socket.on('close', function(){
        device.tcp_socket = null;
  });
  device.tcp_socket = socket;
});

system_server.listen(1338);
console.log('System server listening to port 1338');
/* SYSTEM TCP SERVER ENDS */


/* UDP HEARTBEAT SENDER: UDP Broadcaster */
var dgram = require('dgram');
var message = new Buffer("Some bytes");
var client = dgram.createSocket("udp4");
client.bind(function(){
    client.setBroadcast(true);	//enable broadcasting after socket binding
});

setInterval(function(){
    var msg =  {device_id: device.id,
				status: 'OK',
				location: {lat: 100, lon: 100},
				vid_src: video.video_src,
				md_mode: video.md_mode,
				time: Date.now()};
    var message = new Buffer(JSON.stringify(msg));	//Convert a value/an object  to JSON
    client.send(message, 0, message.length, 1400, "255.255.255.255", function(err, bytes) {
      console.log('heartbeat sent!');
    });  
}, 2000);
/* UDP HEARTBEAT ENDS */


/* VIDEO APP FORKER STARTS */
/*
var videoApp = exec('./videoApp 127.0.0.1 1337', function (error, stdout, stderr) {
    if (error !== null) {
        console.log('App Run Failed ' + error);
    }
    else{
        console.log('App Run Successfully!');
    }
});
        
videoApp.on('exit', function(code, signal){
    if(code !== null){
        console.log('videoApp exit with code: ' + code);
    }
    else{
        console.log('videoApp killed with signal ' + signal);
    }
});
/* VIDEO APP FORKER ENDS */


/* TEST CODE */
/*
setInterval(function(){
    if(video.socket != null){
        if(video.video_src === 1){
            setVideoSrc(video.socket, 2);
        }
        else{
            setVideoSrc(video.socket, 1);
        }
    }
}, 5010);

setInterval(function(){
    if(video.socket != null){
        if(video.md_mode === 2){
            setMdMode(video.socket, 0);
        }
        else{
            var mode = video.md_mode + 1;
            setMdMode(video.socket, mode);
        }
    }
}, 5000);

/* END TEST CODE */
