'use strict';
/* Controllers */
angular.module('myApp.controllers', []).
  controller('MyCtrl1', ['socket','$scope', function(socket, $scope) {
    $scope.devices = [];
    $scope.alarms = [];
    
    $scope.setMdMode = function(device, md_val){
        var msg = {device_id: device.device_id, vid_src: device.vid_src, md_mode: md_val};
        socket.emit('config', msg);
    };
    $scope.setVidSrc = function(device, src_val){
        var msg = {device_id: device.device_id, vid_src: src_val, md_mode: device.md_mode};
        socket.emit('config', msg);
    };
    socket.emit('getDeviceList', {data: 'abc'});
  
    socket.on('caminfo', function (data) {
        $scope.devices.push(data);
    });
    socket.on('newcam', function (data) {
        $scope.devices.push(data);
    });
    socket.on('updatecam', function (data) {
        //console.log(data);
        for(var i=0; i<$scope.devices.length; i++){
            if($scope.devices[i].device_id === data.device_id){
                $scope.devices[i].time = data.time;
                $scope.devices[i].vid_src = data.vid_src;
                $scope.devices[i].md_mode = data.md_mode;
                $scope.devices[i].status = data.status;
                break;
            }
        }
    });
    socket.on('dropcam', function (data) {
        //console.log(data);
        for(var i=0; i<$scope.devices.length; i++){
            if($scope.devices[i].device_id === data.device_id){
                $scope.devices.splice(i,1);
                break;
            }
        }
    });
    socket.on('alarm', function (data) {
        console.log(data.alarm);
        $scope.alarms.push(data.alarm);
    });
    
  }])
  .controller('MyCtrl2', [function() {
  }]);

