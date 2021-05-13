//globals
let mediaRecorder;
var peerConnection;
var dataChannel;
var source = document.createElement('source');
const input = document.querySelector('button#showVideo');
const recordButton = document.querySelector('button#record');
const findPeerButton = document.querySelector('button#findPeer');
const videoBlock = document.querySelector('#serverVideoBlock');
const videosBlock = document.querySelector('#serverVideosBlock');
const constraints = window.constraints = {
    audio: false,
    video: true
};

//connecting to our signaling server
var conn = new WebSocket('ws://hajus2.herokuapp.com/socket');

conn.onopen = function() {
    console.log("Connected to the signaling server");
    initialize();
};

conn.onmessage = function(msg) {
    console.log("Got message", msg.data);
    var content = JSON.parse(msg.data);
    var data = content.data;
    switch (content.event) {
        case "offer":
            handleOffer(data);
            break;
        case "answer":
            handleAnswer(data);
            break;
        case "candidate":
            handleCandidate(data);
            break;
        default:
            break;
    }
};

function send(message) {
    conn.send(JSON.stringify(message));
}

function initialize() {
    var configuration = {
        "iceServers": [{
            "url": "stun:stun2.1.google.com:19302"
        }]
    };

    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onicecandidate = function(event) {
        if (event.candidate) {
            send({
                event: "candidate",
                data: event.candidate
            });
        }
    };

    dataChannel = peerConnection.createDataChannel("dataChannel", {
        reliable: true
    });

    dataChannel.onerror = function(error) {
        console.log("Error occured on datachannel:", error);
    };

    dataChannel.onmessage = function(event) {
        console.log("message:", event.data);
    };

    dataChannel.onclose = function() {
        stopRecording();
        console.log("data channel is closed");
    };

    peerConnection.ondatachannel = function(event) {
        dataChannel = event.channel;
    };

    peerConnection.onaddstream = function(event) {
        console.log('received stream!');
        const video = document.querySelector('#remoteVideo');
        video.srcObject = event.stream;
        video.play();
        console.log('finished');
    };

}

function createOffer() {
    peerConnection.createOffer(function(offer) {
        send({
            event: "offer",
            data: offer
        });
        peerConnection.setLocalDescription(offer);
    }, function(error) {
        alert("Error creating an offer");
    });
}

function handleOffer(offer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    peerConnection.createAnswer(function(answer) {
        peerConnection.setLocalDescription(answer);
        send({
            event: "answer",
            data: answer
        });
    }, function(error) {
        alert("Error creating an answer");
    });

};

function handleCandidate(candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
};

function handleAnswer(answer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("connection established successfully!!");
};

function sendMessage() {
    dataChannel.send(input.value);
    input.value = "";
}

//play local video
input.addEventListener('click', e => init(e));

async function init(e) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(
            constraints).
        then(function(stream) {
            startRecording(stream);
            peerConnection.addStream(stream);
            const video = document.querySelector('#localVideo');
            video.srcObject = stream;
            video.play();
            recordButton.disabled = false;
            findPeer.disabled = false;
        }).catch(function(err) {
            console.log(err);
        });
        e.target.disabled = true;
    } catch (e) {
        console.log(e);
    }

}

function handleSuccess(stream) {
    const video = document.querySelector('video');
    video.srcObject = stream;
}

//recording logic
function startRecording(stream) {
    const mimeType = 'video/webm';
    const options = {
        mimeType
    };

    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
        console.error('Exception while creating MediaRecorder:', e);
        return;
    }
    mediaRecorder.onstop = (event) => {
        console.log('Recorder stopped: ', event);
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start();
    console.log('MediaRecorder started', mediaRecorder);
}

function stopRecording() {
    mediaRecorder.stop();
    recordButton.disabled = true;
}

function handleDataAvailable(event) {
    console.log('handleDataAvailable', event);
    if (event.data && event.data.size > 0) {
        var fd = new FormData();
        fd.append('data', event.data);
        $.ajax({
            type: 'POST',
            enctype: 'multipart/form-data',
            url: 'http://hajus2.herokuapp.com/upload',
            data: fd,
            processData: false,
            contentType: false,
            cache: false,
            timeout: 600000
        }).done(function(data) {
            console.log(data);
        });
    }
}


//video playback logic
async function getVideos() {
    videosBlock.style.visibility = "visible";
    const response = await fetch('http://hajus2.herokuapp.com/videos').then(
        function(response) {
            return response.text();
        }).then(function(videosFromServer) {
        console.log(videosFromServer);
        parsedVideos = JSON.parse(videosFromServer);
        var videosList = document.getElementById("videosList");
        videosList.replaceChildren();
        parsedVideos.forEach(function(parsedVideo) {
            var listElement = document.createElement('a');
            listElement.className = "list-group-item";
            listElement.setAttribute('href', "#");
            listElement.textContent = parsedVideo;
            videosList.appendChild(listElement);
        });
        videosList.addEventListener('click', function(event) {
            if (event.target !== this) {
                const video = document.querySelector(
                    '#serverVideo');
                videoBlock.style.visibility = "visible";
                const downloadVideoButton = document
                    .querySelector('a#downloadVideo');
                downloadVideoButton.setAttribute('href',
                    "http://localhost:8080/download/" +
                    event.target.textContent);
                downloadVideoButton.setAttribute('download',
                    "");
                source.setAttribute('src',
                    'http://hajus2.herokuapp.com/download/' +
                    event.target.textContent);
                video.appendChild(source);
                video.load();
                video.play();
            }
        });

    });

}

function closeVideoBlock() {
    videoBlock.style.visibility = "hidden";
}

function closeVideosBlock() {
    videosBlock.style.visibility = "hidden";
}