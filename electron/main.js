const audio = document.getElementById('audioSource')
const skip = document.getElementById('skipButton')
const fixMicrophone = document.getElementById('fixMicButton')

!async function () {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioDevice = devices.find((device) => device.label === 'CABLE Input (VB-Audio Virtual Cable)')

    if (audioDevice) {
        const audio = document.getElementById('audioSource')
        await audio.setSinkId(audioDevice.deviceId)
        audio.volume = 0.5
        console.log(`Audio is being output on ${audio.sinkId}`)
    } else {
        alert('Could not find CABLE Input device. Please make sure you\'ve installed VB Audio Virtual Cable.')
    }
}()

audio.addEventListener('loadeddata', function () {
    window.electronAPI.songPlaying()
})

audio.addEventListener('ended', function () {
    window.electronAPI.songFinished()
})

skip.addEventListener('click', function () {
    window.electronAPI.skipSong()
    audio.src = ''
})

fixMicrophone.addEventListener('click', function () {
    window.electronAPI.fixMicrophone()
})

window.electronAPI.changeSong(function (song) {
    audio.src = song.audio.url
    audio.play()
})